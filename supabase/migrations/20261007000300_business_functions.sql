-- =============================================================================
-- MILAN · Lógica de negocio (RPC transaccionales, validadas en servidor)
-- Todas son SECURITY DEFINER y validan permisos explícitamente.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Horario del negocio
-- business_settings.opening_hours = {"1": null, "2": {"open":"09:00","close":"19:00"}, ...}
-- (1 = lunes … 7 = domingo, ISO)
-- -----------------------------------------------------------------------------

create or replace function public.is_within_business_hours(p_start timestamptz, p_end timestamptz)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_local_start timestamp := p_start at time zone 'America/Bogota';
  v_local_end timestamp := p_end at time zone 'America/Bogota';
  v_day jsonb;
begin
  v_day := public.get_setting('opening_hours') -> extract(isodow from v_local_start)::int::text;
  if v_day is null or jsonb_typeof(v_day) <> 'object' then
    return false;
  end if;
  return v_local_start::time >= (v_day ->> 'open')::time
     and v_local_end <= v_local_start::date + (v_day ->> 'close')::time;
end;
$$;

-- -----------------------------------------------------------------------------
-- Clientes
-- -----------------------------------------------------------------------------

-- Uso interno: encuentra la clienta por id o teléfono; si no existe, la crea.
-- Nunca duplica por diferencias de nombre: el teléfono manda.
create or replace function public.resolve_customer(
  p_customer_id uuid,
  p_phone text,
  p_name text,
  p_source text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_phone text;
begin
  if p_customer_id is not null then
    select id into v_id from public.customers where id = p_customer_id;
    if v_id is null then
      raise exception 'La clienta no existe' using errcode = 'P0002';
    end if;
    return v_id;
  end if;

  if nullif(btrim(coalesce(p_phone, '')), '') is not null then
    v_phone := public.normalize_phone(p_phone);
    if v_phone is null then
      raise exception 'Teléfono inválido' using errcode = '22023';
    end if;
    select id into v_id from public.customers where phone_e164 = v_phone;
    if v_id is not null then
      return v_id;
    end if;
  end if;

  if nullif(btrim(coalesce(p_name, '')), '') is null then
    raise exception 'Escribe el nombre de la clienta' using errcode = '22023';
  end if;

  insert into public.customers (full_name, phone_e164, source, created_by)
  values (p_name, v_phone, coalesce(p_source, 'presencial'), auth.uid())
  on conflict (phone_e164) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.customers where phone_e164 = v_phone;
  end if;
  return v_id;
end;
$$;

-- Búsqueda mínima por teléfono para agendar (sin datos financieros).
create or replace function public.find_customer_by_phone(p_phone text)
returns table (id uuid, full_name text, phone_e164 text, notes text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (public.has_permission('customers.read_all') or public.has_permission('appointments.create')) then
    raise exception 'No tienes permiso para realizar esta acción' using errcode = '42501';
  end if;
  return query
    select c.id, c.full_name, c.phone_e164, c.notes
    from public.customers c
    where c.phone_e164 = public.normalize_phone(p_phone);
end;
$$;

-- -----------------------------------------------------------------------------
-- Agenda
-- -----------------------------------------------------------------------------

create or replace function public.services_duration(p_service_ids uuid[])
returns int
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_missing int;
  v_total int;
begin
  if p_service_ids is null or cardinality(p_service_ids) = 0 then
    raise exception 'Selecciona al menos un servicio' using errcode = '22023';
  end if;
  select count(*) into v_missing
    from unnest(p_service_ids) sid
   where not exists (select 1 from public.services s where s.id = sid and s.is_active);
  if v_missing > 0 then
    raise exception 'Hay un servicio que no existe o está inactivo' using errcode = '22023';
  end if;
  select sum(s.duration_min) into v_total
    from unnest(p_service_ids) sid
    join public.services s on s.id = sid;
  return v_total;
end;
$$;

create or replace function public.create_appointment(
  p_staff_id uuid,
  p_starts_at timestamptz,
  p_service_ids uuid[],
  p_customer_id uuid default null,
  p_customer_phone text default null,
  p_customer_name text default null,
  p_channel text default 'presencial',
  p_notes text default null,
  p_design_notes text default null,
  p_reference_image_path text default null,
  p_status text default 'pendiente',
  p_allow_outside_hours boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_id uuid;
  v_ends timestamptz;
  v_id uuid;
begin
  if not (public.has_permission('appointments.manage_all') or public.has_permission('appointments.create')) then
    raise exception 'No tienes permiso para crear citas' using errcode = '42501';
  end if;
  if p_status not in ('pendiente', 'confirmada') then
    raise exception 'Estado inicial inválido' using errcode = '22023';
  end if;
  if p_channel not in ('whatsapp', 'instagram', 'presencial', 'referido', 'otro') then
    raise exception 'Canal de origen inválido' using errcode = '22023';
  end if;
  if not exists (select 1 from public.staff where id = p_staff_id and is_active) then
    raise exception 'Selecciona una profesional válida' using errcode = '22023';
  end if;

  v_ends := p_starts_at + make_interval(mins => public.services_duration(p_service_ids));

  if not public.is_within_business_hours(p_starts_at, v_ends)
     and not (p_allow_outside_hours and public.has_permission('appointments.manage_all')) then
    raise exception 'La cita queda fuera del horario de atención' using errcode = 'P0001';
  end if;

  v_customer_id := public.resolve_customer(p_customer_id, p_customer_phone, p_customer_name, p_channel);

  begin
    insert into public.appointments (
      customer_id, staff_id, starts_at, ends_at, status, channel,
      notes, design_notes, reference_image_path, created_by
    ) values (
      v_customer_id, p_staff_id, p_starts_at, v_ends, p_status, p_channel,
      nullif(btrim(p_notes), ''), nullif(btrim(p_design_notes), ''),
      p_reference_image_path, auth.uid()
    )
    returning id into v_id;
  exception when exclusion_violation then
    raise exception 'La profesional ya tiene una cita en ese horario' using errcode = '23P01';
  end;

  insert into public.appointment_services (appointment_id, service_id, price, duration_min, sort_order)
  select v_id, s.id, s.base_price, s.duration_min, x.ord::int
    from unnest(p_service_ids) with ordinality as x(sid, ord)
    join public.services s on s.id = x.sid;

  return v_id;
end;
$$;

create or replace function public.update_appointment(
  p_appointment_id uuid,
  p_staff_id uuid,
  p_starts_at timestamptz,
  p_service_ids uuid[],
  p_channel text,
  p_notes text default null,
  p_design_notes text default null,
  p_reference_image_path text default null,
  p_allow_outside_hours boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appt public.appointments;
  v_ends timestamptz;
begin
  select * into v_appt from public.appointments where id = p_appointment_id for update;
  if v_appt.id is null then
    raise exception 'La cita no existe' using errcode = 'P0002';
  end if;
  if not (
    public.has_permission('appointments.manage_all')
    or (public.has_permission('appointments.create') and v_appt.staff_id = public.current_staff_id())
  ) then
    raise exception 'No tienes permiso para modificar esta cita' using errcode = '42501';
  end if;
  if v_appt.status not in ('pendiente', 'confirmada') then
    raise exception 'Solo se pueden modificar citas pendientes o confirmadas' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.staff where id = p_staff_id and is_active) then
    raise exception 'Selecciona una profesional válida' using errcode = '22023';
  end if;
  if p_channel not in ('whatsapp', 'instagram', 'presencial', 'referido', 'otro') then
    raise exception 'Canal de origen inválido' using errcode = '22023';
  end if;

  v_ends := p_starts_at + make_interval(mins => public.services_duration(p_service_ids));

  if not public.is_within_business_hours(p_starts_at, v_ends)
     and not (p_allow_outside_hours and public.has_permission('appointments.manage_all')) then
    raise exception 'La cita queda fuera del horario de atención' using errcode = 'P0001';
  end if;

  begin
    update public.appointments
       set staff_id = p_staff_id,
           starts_at = p_starts_at,
           ends_at = v_ends,
           channel = p_channel,
           notes = nullif(btrim(p_notes), ''),
           design_notes = nullif(btrim(p_design_notes), ''),
           reference_image_path = coalesce(p_reference_image_path, reference_image_path)
     where id = p_appointment_id;
  exception when exclusion_violation then
    raise exception 'La profesional ya tiene una cita en ese horario' using errcode = '23P01';
  end;

  delete from public.appointment_services where appointment_id = p_appointment_id;
  insert into public.appointment_services (appointment_id, service_id, price, duration_min, sort_order)
  select p_appointment_id, s.id, s.base_price, s.duration_min, x.ord::int
    from unnest(p_service_ids) with ordinality as x(sid, ord)
    join public.services s on s.id = x.sid;

  if v_appt.starts_at <> p_starts_at or v_appt.staff_id <> p_staff_id then
    perform public.log_audit('appointment.reschedule', 'appointments', p_appointment_id::text,
      jsonb_build_object(
        'antes', jsonb_build_object('starts_at', v_appt.starts_at, 'staff_id', v_appt.staff_id),
        'despues', jsonb_build_object('starts_at', p_starts_at, 'staff_id', p_staff_id)));
  end if;
end;
$$;

create or replace function public.set_appointment_status(
  p_appointment_id uuid,
  p_status text,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appt public.appointments;
  v_is_manager boolean := public.has_permission('appointments.manage_all');
  v_is_own boolean;
  v_allowed text[];
begin
  select * into v_appt from public.appointments where id = p_appointment_id for update;
  if v_appt.id is null then
    raise exception 'La cita no existe' using errcode = 'P0002';
  end if;
  v_is_own := v_appt.staff_id = public.current_staff_id();

  if not (v_is_manager or v_is_own) then
    raise exception 'No tienes permiso para modificar esta cita' using errcode = '42501';
  end if;

  v_allowed := case v_appt.status
    when 'pendiente' then array['confirmada', 'en_servicio', 'cancelada', 'no_asistio']
    when 'confirmada' then array['pendiente', 'en_servicio', 'cancelada', 'no_asistio']
    when 'en_servicio' then array['confirmada']
    when 'cancelada' then array['pendiente']
    when 'no_asistio' then array['pendiente']
    else array[]::text[]
  end;
  if not (p_status = any (v_allowed)) then
    raise exception 'No se puede pasar la cita de "%" a "%"', v_appt.status, p_status using errcode = 'P0001';
  end if;

  if p_status = 'cancelada' and not (v_is_manager or public.has_permission('appointments.create')) then
    raise exception 'No tienes permiso para cancelar citas' using errcode = '42501';
  end if;
  if v_appt.status in ('cancelada', 'no_asistio') and not v_is_manager then
    raise exception 'Solo administración puede reactivar citas' using errcode = '42501';
  end if;

  begin
    update public.appointments
       set status = p_status,
           started_at = case
             when p_status = 'en_servicio' then now()
             when p_status in ('pendiente', 'confirmada') then null
             else started_at end,
           cancelled_at = case when p_status = 'cancelada' then now() when p_status = 'pendiente' then null else cancelled_at end,
           cancel_reason = case when p_status = 'cancelada' then nullif(btrim(p_reason), '') when p_status = 'pendiente' then null else cancel_reason end
     where id = p_appointment_id;
  exception when exclusion_violation then
    raise exception 'Ese horario ya fue ocupado por otra cita' using errcode = '23P01';
  end;

  if p_status in ('cancelada', 'no_asistio') or v_appt.status in ('cancelada', 'no_asistio') then
    perform public.log_audit('appointment.' || p_status, 'appointments', p_appointment_id::text,
      jsonb_build_object('antes', v_appt.status, 'despues', p_status, 'motivo', p_reason));
  end if;
end;
$$;

-- Horarios disponibles: el agente y la UI consultan aquí, nunca inventan.
create or replace function public.get_available_slots(
  p_date date,
  p_service_ids uuid[],
  p_staff_id uuid default null
)
returns table (staff_id uuid, staff_name text, starts_at timestamptz, ends_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_duration int;
  v_day jsonb;
  v_step int;
begin
  if not (public.is_active_member() or public.is_service_role()) then
    raise exception 'No tienes permiso para realizar esta acción' using errcode = '42501';
  end if;
  v_duration := public.services_duration(p_service_ids);
  v_day := public.get_setting('opening_hours') -> extract(isodow from p_date)::int::text;
  if v_day is null or jsonb_typeof(v_day) <> 'object' then
    return;
  end if;
  v_step := coalesce((public.get_setting('agenda') ->> 'slot_minutes')::int, 30);

  return query
    with slots as (
      select gs as slot_start
        from generate_series(
          public.local_day_start(p_date) + ((v_day ->> 'open')::time - time '00:00'),
          public.local_day_start(p_date) + ((v_day ->> 'close')::time - time '00:00') - make_interval(mins => v_duration),
          make_interval(mins => v_step)
        ) gs
    )
    select s.id, s.display_name, sl.slot_start, sl.slot_start + make_interval(mins => v_duration)
      from public.staff s
      cross join slots sl
     where s.is_active
       and (p_staff_id is null or s.id = p_staff_id)
       and sl.slot_start > now()
       and not exists (
         select 1 from public.appointments a
          where a.staff_id = s.id
            and a.status not in ('cancelada', 'no_asistio')
            and tstzrange(a.starts_at, a.ends_at, '[)')
                && tstzrange(sl.slot_start, sl.slot_start + make_interval(mins => v_duration), '[)')
       )
     order by sl.slot_start, s.sort_order, s.display_name;
end;
$$;

-- -----------------------------------------------------------------------------
-- Ventas y comisiones
-- -----------------------------------------------------------------------------

create or replace function public.current_commission_percent(p_staff_id uuid, p_at timestamptz default now())
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select percent from public.commission_rules
     where staff_id = p_staff_id and effective_from <= p_at
     order by effective_from desc
     limit 1
  ), 0);
$$;

-- Cierra una cita: crea venta + ítems + comisión y finaliza la cita, todo en
-- una transacción. p_items: [{kind, service_id?, extra_id?, description?, unit_price, quantity?}]
create or replace function public.complete_appointment(
  p_appointment_id uuid,
  p_items jsonb,
  p_payment_method_id uuid,
  p_discount bigint default 0,
  p_staff_id uuid default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appt public.appointments;
  v_staff_id uuid;
  v_sale_id uuid;
  v_item jsonb;
  v_kind text;
  v_unit bigint;
  v_qty int;
  v_service public.services;
  v_extra public.service_extras;
  v_desc text;
  v_list bigint;
  v_commissionable boolean;
  v_services_total bigint := 0;
  v_extras_total bigint := 0;
  v_commissionable_total bigint := 0;
  v_gross bigint;
  v_total bigint;
  v_discount bigint := coalesce(p_discount, 0);
  v_percent numeric;
  v_base bigint;
  v_commission bigint;
  v_base_mode text;
  v_payment_name text;
begin
  select * into v_appt from public.appointments where id = p_appointment_id for update;
  if v_appt.id is null then
    raise exception 'La cita no existe' using errcode = 'P0002';
  end if;
  if not (
    public.has_permission('appointments.manage_all')
    or (public.has_permission('sales.create') and v_appt.staff_id = public.current_staff_id())
  ) then
    raise exception 'No tienes permiso para cerrar esta cita' using errcode = '42501';
  end if;
  if v_appt.status not in ('pendiente', 'confirmada', 'en_servicio') then
    raise exception 'Esta cita ya fue cerrada o cancelada' using errcode = 'P0001';
  end if;

  v_staff_id := coalesce(p_staff_id, v_appt.staff_id);
  if not exists (select 1 from public.staff where id = v_staff_id and is_active) then
    raise exception 'Selecciona quién atendió' using errcode = '22023';
  end if;
  select name into v_payment_name from public.payment_methods where id = p_payment_method_id and is_active;
  if v_payment_name is null then
    raise exception 'Selecciona un medio de pago' using errcode = '22023';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Agrega al menos un servicio' using errcode = '22023';
  end if;
  if v_discount < 0 then
    raise exception 'El descuento no puede ser negativo' using errcode = '22023';
  end if;

  insert into public.sales (
    appointment_id, customer_id, staff_id, services_total, extras_total,
    discount, total, payment_method_id, notes, created_by
  ) values (
    v_appt.id, v_appt.customer_id, v_staff_id, 0, 0, 0, 0,
    p_payment_method_id, nullif(btrim(p_notes), ''), auth.uid()
  )
  returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_kind := v_item ->> 'kind';
    v_unit := (v_item ->> 'unit_price')::bigint;
    v_qty := coalesce((v_item ->> 'quantity')::int, 1);
    if v_unit is null or v_unit < 0 then
      raise exception 'Precio inválido' using errcode = '22023';
    end if;
    if v_qty < 1 then
      raise exception 'Cantidad inválida' using errcode = '22023';
    end if;

    if v_kind = 'servicio' then
      select * into v_service from public.services where id = (v_item ->> 'service_id')::uuid;
      if v_service.id is null then
        raise exception 'Servicio no válido' using errcode = '22023';
      end if;
      v_desc := v_service.name;
      v_list := v_service.base_price;
      v_commissionable := v_service.commissionable;
      v_services_total := v_services_total + v_unit * v_qty;
      insert into public.sale_items (sale_id, kind, service_id, description, list_price, unit_price, quantity, commissionable)
      values (v_sale_id, 'servicio', v_service.id, v_desc, v_list, v_unit, v_qty, v_commissionable);
    elsif v_kind = 'extra' then
      v_extra := null;
      if v_item ? 'extra_id' and nullif(v_item ->> 'extra_id', '') is not null then
        select * into v_extra from public.service_extras where id = (v_item ->> 'extra_id')::uuid;
        if v_extra.id is null then
          raise exception 'Extra no válido' using errcode = '22023';
        end if;
      end if;
      v_desc := coalesce(nullif(btrim(v_item ->> 'description'), ''), v_extra.name);
      if v_desc is null then
        raise exception 'Describe el extra' using errcode = '22023';
      end if;
      v_list := coalesce(v_extra.price, v_unit);
      v_commissionable := coalesce(v_extra.commissionable, true);
      v_extras_total := v_extras_total + v_unit * v_qty;
      insert into public.sale_items (sale_id, kind, extra_id, description, list_price, unit_price, quantity, commissionable)
      values (v_sale_id, 'extra', v_extra.id, v_desc, v_list, v_unit, v_qty, v_commissionable);
    else
      raise exception 'Tipo de ítem inválido' using errcode = '22023';
    end if;

    if v_commissionable then
      v_commissionable_total := v_commissionable_total + v_unit * v_qty;
    end if;
  end loop;

  v_gross := v_services_total + v_extras_total;
  if v_discount > v_gross then
    raise exception 'El descuento no puede superar el valor de la venta' using errcode = '22023';
  end if;
  v_total := v_gross - v_discount;

  update public.sales
     set services_total = v_services_total,
         extras_total = v_extras_total,
         discount = v_discount,
         total = v_total
   where id = v_sale_id;

  -- Comisión: por defecto sobre el valor del servicio después del descuento
  -- (el descuento se reparte proporcionalmente). Configurable en
  -- business_settings.commission.base = 'neto' | 'bruto'.
  v_base_mode := coalesce(public.get_setting('commission') ->> 'base', 'neto');
  if v_base_mode = 'bruto' or v_gross = 0 then
    v_base := v_commissionable_total;
  else
    v_base := v_commissionable_total - round(v_discount::numeric * v_commissionable_total / v_gross)::bigint;
  end if;
  v_percent := public.current_commission_percent(v_staff_id, now());
  v_commission := round(v_base * v_percent / 100)::bigint;

  insert into public.commission_records (sale_id, staff_id, base_amount, percent, commission_amount, business_amount)
  values (v_sale_id, v_staff_id, v_base, v_percent, v_commission, v_total - v_commission);

  update public.appointments
     set status = 'finalizada',
         started_at = coalesce(started_at, now()),
         finished_at = now()
   where id = v_appt.id;

  update public.customers set status = 'activa'
   where id = v_appt.customer_id and status = 'inactiva';

  return jsonb_build_object(
    'sale_id', v_sale_id,
    'total', v_total,
    'payment_method', v_payment_name,
    'commission_amount', v_commission,
    'commission_percent', v_percent
  );
end;
$$;

create or replace function public.void_sale(p_sale_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale public.sales;
begin
  perform public.require_permission('sales.manage');
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'Escribe el motivo de la anulación' using errcode = '22023';
  end if;
  select * into v_sale from public.sales where id = p_sale_id for update;
  if v_sale.id is null then
    raise exception 'La venta no existe' using errcode = 'P0002';
  end if;
  if v_sale.status = 'anulada' then
    raise exception 'La venta ya está anulada' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.commission_records where sale_id = p_sale_id and status = 'pagada') then
    raise exception 'La comisión de esta venta ya fue pagada; no se puede anular' using errcode = 'P0001';
  end if;

  update public.sales
     set status = 'anulada', void_reason = btrim(p_reason), voided_at = now(), voided_by = auth.uid()
   where id = p_sale_id;
  update public.commission_records set status = 'anulada' where sale_id = p_sale_id;
  -- La cita vuelve a "en servicio" para poder cerrarla de nuevo correctamente.
  update public.appointments set status = 'en_servicio', finished_at = null
   where id = v_sale.appointment_id and status = 'finalizada';

  perform public.log_audit('sale.void', 'sales', p_sale_id::text,
    jsonb_build_object('motivo', p_reason, 'total', v_sale.total));
end;
$$;

create or replace function public.update_sale_payment_method(p_sale_id uuid, p_payment_method_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_permission('sales.manage');
  if not exists (select 1 from public.payment_methods where id = p_payment_method_id) then
    raise exception 'Medio de pago no válido' using errcode = '22023';
  end if;
  update public.sales set payment_method_id = p_payment_method_id
   where id = p_sale_id and status = 'registrada';
  if not found then
    raise exception 'La venta no existe o está anulada' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.set_commission_percent(p_staff_id uuid, p_percent numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_permission('commissions.manage');
  if p_percent is null or p_percent < 0 or p_percent > 100 then
    raise exception 'El porcentaje debe estar entre 0 y 100' using errcode = '22023';
  end if;
  if not exists (select 1 from public.staff where id = p_staff_id) then
    raise exception 'La profesional no existe' using errcode = 'P0002';
  end if;
  insert into public.commission_rules (staff_id, percent, effective_from, created_by)
  values (p_staff_id, p_percent, now(), auth.uid());
end;
$$;

create or replace function public.mark_commissions_paid(p_record_ids uuid[])
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  perform public.require_permission('commissions.manage');
  update public.commission_records
     set status = 'pagada', paid_at = now(), paid_by = auth.uid()
   where id = any (p_record_ids) and status = 'pendiente';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Resumen de comisiones por profesional en un rango de fechas locales.
-- Colaboradoras solo ven su propio resumen.
create or replace function public.commission_summary(p_from date, p_to date)
returns table (
  staff_id uuid,
  staff_name text,
  sales_count bigint,
  total_sold bigint,
  base_amount bigint,
  commission_amount bigint,
  business_amount bigint,
  pending_amount bigint,
  current_percent numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_all boolean := public.has_permission('commissions.read_all');
  v_own uuid := public.current_staff_id();
begin
  if not v_all and v_own is null then
    raise exception 'No tienes permiso para realizar esta acción' using errcode = '42501';
  end if;
  return query
    select st.id,
           st.display_name,
           coalesce(agg.sales_count, 0)::bigint,
           coalesce(agg.total_sold, 0)::bigint,
           coalesce(agg.base_amount, 0)::bigint,
           coalesce(agg.commission_amount, 0)::bigint,
           coalesce(agg.business_amount, 0)::bigint,
           coalesce(agg.pending_amount, 0)::bigint,
           public.current_commission_percent(st.id, now())
      from public.staff st
      left join lateral (
        select count(*) as sales_count,
               sum(s.total) as total_sold,
               sum(cr.base_amount) as base_amount,
               sum(cr.commission_amount) as commission_amount,
               sum(cr.business_amount) as business_amount,
               sum(cr.commission_amount) filter (where cr.status = 'pendiente') as pending_amount
          from public.commission_records cr
          join public.sales s on s.id = cr.sale_id
         where cr.staff_id = st.id
           and cr.status <> 'anulada'
           and s.sold_at >= public.local_day_start(p_from)
           and s.sold_at < public.local_day_start(p_to + 1)
      ) agg on true
     where (v_all or st.id = v_own)
       and (st.is_active or coalesce(agg.sales_count, 0) > 0)
     order by st.sort_order, st.display_name;
end;
$$;

-- -----------------------------------------------------------------------------
-- Inventario
-- -----------------------------------------------------------------------------

create or replace function public.register_inventory_movement(
  p_item_id uuid,
  p_type text,
  p_quantity numeric,
  p_reason text default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.inventory_items;
  v_delta numeric;
  v_after numeric;
  v_id uuid;
begin
  if p_type in ('entrada', 'ajuste') then
    perform public.require_permission('inventory.manage');
  elsif p_type in ('salida', 'perdida', 'dano') then
    if not (public.has_permission('inventory.manage') or public.has_permission('inventory.report')) then
      raise exception 'No tienes permiso para realizar esta acción' using errcode = '42501';
    end if;
  else
    raise exception 'Tipo de movimiento inválido' using errcode = '22023';
  end if;
  if p_quantity is null or p_quantity < 0 or (p_type <> 'ajuste' and p_quantity = 0) then
    raise exception 'Cantidad inválida' using errcode = '22023';
  end if;
  if p_type in ('ajuste', 'perdida', 'dano') and nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'Escribe el motivo del movimiento' using errcode = '22023';
  end if;

  select * into v_item from public.inventory_items where id = p_item_id for update;
  if v_item.id is null then
    raise exception 'El producto no existe' using errcode = 'P0002';
  end if;

  v_delta := case p_type
    when 'entrada' then p_quantity
    when 'ajuste' then p_quantity - v_item.quantity
    else -p_quantity
  end;
  v_after := v_item.quantity + v_delta;
  if v_after < 0 then
    raise exception 'No hay suficiente stock (disponible: %)', v_item.quantity using errcode = 'P0001';
  end if;

  perform set_config('milan.stock_change', 'on', true);
  update public.inventory_items set quantity = v_after where id = p_item_id;
  perform set_config('milan.stock_change', 'off', true);

  insert into public.inventory_movements (
    item_id, movement_type, quantity, delta, quantity_before, quantity_after, reason, note, created_by
  ) values (
    p_item_id, p_type, p_quantity, v_delta, v_item.quantity, v_after,
    nullif(btrim(p_reason), ''), nullif(btrim(p_note), ''), auth.uid()
  )
  returning id into v_id;

  if p_type in ('ajuste', 'perdida', 'dano') then
    perform public.log_audit('inventory.' || p_type, 'inventory_items', p_item_id::text,
      jsonb_build_object('antes', v_item.quantity, 'despues', v_after, 'motivo', p_reason, 'nota', p_note));
  end if;
  return v_id;
end;
$$;

create or replace function public.create_inventory_item(
  p_name text,
  p_category text,
  p_unit text,
  p_min_stock numeric,
  p_initial_quantity numeric default 0,
  p_supplier text default null,
  p_unit_cost bigint default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform public.require_permission('inventory.manage');
  if nullif(btrim(coalesce(p_name, '')), '') is null then
    raise exception 'Escribe el nombre del producto' using errcode = '22023';
  end if;
  insert into public.inventory_items (name, category, unit, min_stock, supplier, unit_cost)
  values (btrim(p_name), coalesce(nullif(btrim(p_category), ''), 'General'),
          coalesce(nullif(btrim(p_unit), ''), 'unidad'), coalesce(p_min_stock, 0),
          nullif(btrim(p_supplier), ''), p_unit_cost)
  returning id into v_id;
  if coalesce(p_initial_quantity, 0) > 0 then
    perform public.register_inventory_movement(v_id, 'entrada', p_initial_quantity, 'Stock inicial', null);
  end if;
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Esmaltes
-- -----------------------------------------------------------------------------

create or replace function public.change_polish_status(
  p_polish_id uuid,
  p_status text,
  p_reason text default null,
  p_comment text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_polish public.nail_polishes;
begin
  if p_status not in ('activo', 'en_uso', 'por_acabarse', 'terminado', 'danado', 'perdido', 'dado_de_baja') then
    raise exception 'Estado inválido' using errcode = '22023';
  end if;
  if not public.has_permission('polishes.manage') then
    if not (public.has_permission('polishes.report')
            and p_status in ('en_uso', 'por_acabarse', 'terminado', 'danado', 'perdido')) then
      raise exception 'No tienes permiso para realizar esta acción' using errcode = '42501';
    end if;
  end if;

  select * into v_polish from public.nail_polishes where id = p_polish_id for update;
  if v_polish.id is null then
    raise exception 'El esmalte no existe' using errcode = 'P0002';
  end if;
  if v_polish.status = p_status then
    raise exception 'El esmalte ya está en ese estado' using errcode = 'P0001';
  end if;
  if v_polish.status = 'dado_de_baja' and not public.has_permission('polishes.manage') then
    raise exception 'Este esmalte fue dado de baja' using errcode = 'P0001';
  end if;

  perform set_config('milan.polish_status_change', 'on', true);
  update public.nail_polishes set status = p_status where id = p_polish_id;
  perform set_config('milan.polish_status_change', 'off', true);

  insert into public.nail_polish_status_history (polish_id, from_status, to_status, reason, comment, changed_by)
  values (p_polish_id, v_polish.status, p_status, nullif(btrim(p_reason), ''), nullif(btrim(p_comment), ''), auth.uid());

  if p_status in ('perdido', 'danado', 'dado_de_baja') then
    perform public.log_audit('polish.' || p_status, 'nail_polishes', p_polish_id::text,
      jsonb_build_object('codigo', v_polish.code, 'antes', v_polish.status, 'motivo', p_reason, 'comentario', p_comment));
  end if;
end;
$$;

-- Al registrar un esmalte queda la primera entrada del historial.
create or replace function public.nail_polishes_initial_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.nail_polish_status_history (polish_id, from_status, to_status, reason, changed_by)
  values (new.id, null, new.status, 'Ingreso', auth.uid());
  return new;
end;
$$;

drop trigger if exists nail_polishes_initial_history on public.nail_polishes;
create trigger nail_polishes_initial_history after insert on public.nail_polishes
  for each row execute function public.nail_polishes_initial_history();

-- -----------------------------------------------------------------------------
-- WhatsApp: handoff humano
-- -----------------------------------------------------------------------------

create or replace function public.set_conversation_mode(p_conversation_id uuid, p_mode text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conv public.whatsapp_conversations;
begin
  perform public.require_permission('whatsapp.manage');
  if p_mode not in ('AI_ACTIVE', 'HUMAN_ACTIVE', 'CLOSED') then
    raise exception 'Modo inválido' using errcode = '22023';
  end if;
  select * into v_conv from public.whatsapp_conversations where id = p_conversation_id for update;
  if v_conv.id is null then
    raise exception 'La conversación no existe' using errcode = 'P0002';
  end if;
  if v_conv.mode = p_mode then
    return;
  end if;
  update public.whatsapp_conversations
     set mode = p_mode,
         assigned_to = case when p_mode = 'HUMAN_ACTIVE' then auth.uid() else null end,
         taken_at = case when p_mode = 'HUMAN_ACTIVE' then now() else null end
   where id = p_conversation_id;
  insert into public.whatsapp_conversation_events (conversation_id, from_mode, to_mode, changed_by)
  values (p_conversation_id, v_conv.mode, p_mode, auth.uid());
  perform public.log_audit('whatsapp.mode', 'whatsapp_conversations', p_conversation_id::text,
    jsonb_build_object('antes', v_conv.mode, 'despues', p_mode));
end;
$$;

-- -----------------------------------------------------------------------------
-- Dashboard
-- -----------------------------------------------------------------------------

create or replace function public.dashboard_summary(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_start timestamptz := public.local_day_start(p_from);
  v_end timestamptz := public.local_day_start(p_to + 1);
  v_today date := (now() at time zone 'America/Bogota')::date;
  v_month_start timestamptz := public.local_day_start(date_trunc('month', (now() at time zone 'America/Bogota'))::date);
  v_result jsonb;
begin
  perform public.require_permission('dashboard.view');

  with range_sales as (
    select * from public.sales
     where status = 'registrada' and sold_at >= v_start and sold_at < v_end
  ),
  range_appts as (
    select * from public.appointments where starts_at >= v_start and starts_at < v_end
  ),
  range_customers as (
    select rs.customer_id,
           (select min(s2.sold_at) from public.sales s2
             where s2.customer_id = rs.customer_id and s2.status = 'registrada') as first_sale
      from range_sales rs
     where rs.customer_id is not null
     group by rs.customer_id
  )
  select jsonb_build_object(
    'sales_total', (select coalesce(sum(total), 0) from range_sales),
    'sales_count', (select count(*) from range_sales),
    'today_sales_total', (
      select coalesce(sum(total), 0) from public.sales
       where status = 'registrada'
         and sold_at >= public.local_day_start(v_today)
         and sold_at < public.local_day_start(v_today + 1)),
    'month_sales_total', (
      select coalesce(sum(total), 0) from public.sales
       where status = 'registrada' and sold_at >= v_month_start),
    'appointments', jsonb_build_object(
      'total', (select count(*) from range_appts),
      'pendientes', (select count(*) from range_appts where status in ('pendiente', 'confirmada', 'en_servicio')),
      'atendidas', (select count(*) from range_appts where status = 'finalizada'),
      'canceladas', (select count(*) from range_appts where status in ('cancelada', 'no_asistio'))
    ),
    'next_appointment', (
      select jsonb_build_object(
        'id', a.id, 'starts_at', a.starts_at, 'customer', c.full_name, 'staff', st.display_name,
        'services', (select string_agg(sv.name, ' + ' order by aps.sort_order)
                       from public.appointment_services aps
                       join public.services sv on sv.id = aps.service_id
                      where aps.appointment_id = a.id))
        from public.appointments a
        join public.customers c on c.id = a.customer_id
        join public.staff st on st.id = a.staff_id
       where a.status in ('pendiente', 'confirmada') and a.starts_at >= now() - interval '15 minutes'
       order by a.starts_at
       limit 1),
    'customers', jsonb_build_object(
      'nuevas', (select count(*) from range_customers where first_sale >= v_start),
      'recurrentes', (select count(*) from range_customers where first_sale < v_start)
    ),
    'top_services', coalesce((
      select jsonb_agg(t order by t.count desc, t.total desc) from (
        select si.description as name, sum(si.quantity) as count, sum(si.line_total) as total
          from public.sale_items si
          join range_sales rs on rs.id = si.sale_id
         where si.kind = 'servicio'
         group by si.description
         order by count desc, total desc
         limit 5) t), '[]'::jsonb),
    'sales_by_staff', coalesce((
      select jsonb_agg(t order by t.total desc) from (
        select st.display_name as name, count(*) as count, sum(rs.total) as total
          from range_sales rs
          join public.staff st on st.id = rs.staff_id
         group by st.display_name) t), '[]'::jsonb),
    'payment_methods', coalesce((
      select jsonb_agg(t order by t.total desc) from (
        select pm.name, count(*) as count, sum(rs.total) as total
          from range_sales rs
          join public.payment_methods pm on pm.id = rs.payment_method_id
         group by pm.name) t), '[]'::jsonb),
    'pending_commissions', (
      select coalesce(sum(commission_amount), 0) from public.commission_records where status = 'pendiente'),
    'inventory_alerts', coalesce((
      select jsonb_agg(t) from (
        select id, name, quantity, unit, min_stock, stock_status
          from public.inventory_items
         where is_active and stock_status <> 'disponible'
         order by stock_status = 'agotado' desc, name
         limit 10) t), '[]'::jsonb),
    'polishes', jsonb_build_object(
      'por_acabarse', (select count(*) from public.nail_polishes where status = 'por_acabarse'),
      'terminado', (select count(*) from public.nail_polishes where status = 'terminado'),
      'danado', (select count(*) from public.nail_polishes where status = 'danado'),
      'perdido', (select count(*) from public.nail_polishes where status = 'perdido')
    )
  ) into v_result;

  return v_result;
end;
$$;

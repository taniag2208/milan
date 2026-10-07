-- =============================================================================
-- MILAN · Helpers de autorización y auditoría
-- =============================================================================

-- Peticiones hechas con la service-role key (solo servidor: webhook, agente).
create or replace function public.is_service_role()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'role', '') = 'service_role';
$$;

-- Usuario autenticado con perfil activo dentro del equipo MILAN.
create or replace function public.is_active_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    join public.roles r on r.id = p.role_id
    where p.id = auth.uid() and p.is_active and r.is_admin
  );
$$;

-- Los roles con is_admin tienen todos los permisos; el resto según role_permissions.
create or replace function public.has_permission(p_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_service_role() or exists (
    select 1
    from public.profiles p
    join public.roles r on r.id = p.role_id
    where p.id = auth.uid()
      and p.is_active
      and (
        r.is_admin
        or exists (
          select 1 from public.role_permissions rp
          where rp.role_id = r.id and rp.permission_key = p_key
        )
      )
  );
$$;

create or replace function public.require_permission(p_key text)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not public.has_permission(p_key) then
    raise exception 'No tienes permiso para realizar esta acción' using errcode = '42501';
  end if;
end;
$$;

-- Profesional (staff) vinculada al usuario actual, si existe.
create or replace function public.current_staff_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.id
  from public.staff s
  join public.profiles p on p.id = s.profile_id
  where s.profile_id = auth.uid() and p.is_active
  limit 1;
$$;

create or replace function public.get_setting(p_key text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select value from public.business_settings where key = p_key;
$$;

-- Fecha local (Bogotá) → rango timestamptz [inicio, fin).
create or replace function public.local_day_start(p_date date)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select (p_date::timestamp) at time zone 'America/Bogota';
$$;

-- -----------------------------------------------------------------------------
-- Auditoría
-- -----------------------------------------------------------------------------

create or replace function public.log_audit(
  p_action text,
  p_entity text,
  p_entity_id text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_logs (actor_id, action, entity, entity_id, metadata)
  values (auth.uid(), p_action, p_entity, p_entity_id, coalesce(p_metadata, '{}'::jsonb));
$$;

-- Trigger genérico: guarda creación, cambios (antes/después) y eliminación.
create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_changes jsonb;
  v_entity_id text;
begin
  if tg_op = 'INSERT' then
    v_new := to_jsonb(new);
    v_entity_id := coalesce(v_new ->> 'id', v_new ->> 'key', v_new ->> 'role_id');
    insert into public.audit_logs (actor_id, action, entity, entity_id, metadata)
    values (auth.uid(), tg_table_name || '.insert', tg_table_name, v_entity_id, jsonb_build_object('nuevo', v_new));
    return new;
  elsif tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    select jsonb_object_agg(n.key, jsonb_build_object('antes', v_old -> n.key, 'despues', n.value))
      into v_changes
      from jsonb_each(v_new) n
     where n.key not in ('updated_at')
       and (v_old -> n.key) is distinct from n.value;
    if v_changes is null then
      return new;
    end if;
    v_entity_id := coalesce(v_new ->> 'id', v_new ->> 'key', v_new ->> 'role_id');
    insert into public.audit_logs (actor_id, action, entity, entity_id, metadata)
    values (auth.uid(), tg_table_name || '.update', tg_table_name, v_entity_id, jsonb_build_object('cambios', v_changes));
    return new;
  else
    v_old := to_jsonb(old);
    v_entity_id := coalesce(v_old ->> 'id', v_old ->> 'key', v_old ->> 'role_id');
    insert into public.audit_logs (actor_id, action, entity, entity_id, metadata)
    values (auth.uid(), tg_table_name || '.delete', tg_table_name, v_entity_id, jsonb_build_object('anterior', v_old));
    return old;
  end if;
end;
$$;

do $$
declare
  t text;
begin
  -- Cambios administrativos y financieros sensibles.
  foreach t in array array[
    'roles', 'role_permissions', 'profiles', 'staff', 'business_settings',
    'payment_methods', 'service_categories', 'services', 'service_extras',
    'sales', 'commission_rules', 'commission_records', 'inventory_items',
    'nail_polishes'
  ] loop
    execute format('drop trigger if exists audit_row_change on public.%I', t);
    execute format(
      'create trigger audit_row_change after insert or update or delete on public.%I
         for each row execute function public.audit_row_change()', t);
  end loop;
end;
$$;

-- Clientes: se audita solo la eliminación (datos personales).
drop trigger if exists audit_row_change on public.customers;
create trigger audit_row_change after delete on public.customers
  for each row execute function public.audit_row_change();

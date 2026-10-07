-- =============================================================================
-- MILAN · Datos DEMO para desarrollo local
-- ⚠️  Solo se carga con `supabase db reset` en local. NUNCA en producción.
-- Todos los registros demo quedan marcados con "DEMO".
-- =============================================================================

do $$
begin
  if exists (select 1 from public.customers where coalesce(notes, '') not like '%DEMO%') then
    raise exception 'La base tiene datos reales: el seed demo no se aplica.';
  end if;
end;
$$;

-- Ejecutar como servidor para usar las mismas RPC que la app.
select set_config('request.jwt.claims', '{"role":"service_role"}', false);

-- Tercera colaboradora demo (Blanca y Liz vienen de la migración inicial).
insert into public.staff (display_name, color, sort_order)
select 'Camila (DEMO)', '#D2C5AB', 3
 where not exists (select 1 from public.staff where display_name = 'Camila (DEMO)');
insert into public.commission_rules (staff_id, percent, effective_from)
select id, 50, '2026-01-01T00:00:00-05:00' from public.staff
 where display_name = 'Camila (DEMO)'
   and not exists (select 1 from public.commission_rules r where r.staff_id = staff.id);

-- 10 clientas demo
insert into public.customers (full_name, phone_e164, source, birth_date, instagram, notes, marketing_consent)
values
  ('Valentina Gómez', '3001110001', 'whatsapp', '1994-10-15', 'valegomez', 'DEMO · Prefiere tonos nude', true),
  ('Daniela Ríos', '3001110002', 'instagram', '1990-03-02', 'danirios', 'DEMO', true),
  ('Laura Martínez', '3001110003', 'presencial', null, null, 'DEMO · Piel sensible', false),
  ('Sofía Herrera', '3001110004', 'referido', '1998-10-20', null, 'DEMO', true),
  ('Camila Torres', '3001110005', 'whatsapp', null, 'camitorres', 'DEMO', false),
  ('Mariana López', '3001110006', 'instagram', '1987-12-01', null, 'DEMO · VIP', true),
  ('Isabella Castro', '3001110007', 'whatsapp', null, null, 'DEMO', false),
  ('Natalia Vargas', '3001110008', 'presencial', '2000-07-09', null, 'DEMO', true),
  ('Paula Moreno', '3001110009', 'otro', null, null, 'DEMO', false),
  ('Andrea Jiménez', '3001110010', 'referido', null, 'andreaj', 'DEMO', true)
on conflict (phone_e164) do nothing;

-- Citas y ventas demo: pasadas (finalizadas) y de hoy (pendientes).
do $$
declare
  v_staff uuid[];
  v_customers uuid[];
  v_services uuid[];
  v_payments uuid[];
  v_appt uuid;
  v_day date := (now() at time zone 'America/Bogota')::date;
  v_start timestamptz;
  v_service uuid;
  v_price bigint;
  v_sale jsonb;
  i int;
begin
  select array_agg(id order by sort_order) into v_staff from public.staff where is_active;
  select array_agg(id order by full_name) into v_customers from public.customers where notes like 'DEMO%';
  select array_agg(id order by sort_order) into v_services
    from public.services where name in ('Semipermanente manos', 'Semipermanente pies', 'Rubber', 'Tradicional', 'Pestañas clásicas', 'Cejas');
  select array_agg(id order by sort_order) into v_payments from public.payment_methods;

  -- 14 citas finalizadas en los últimos 20 días
  for i in 1..14 loop
    v_start := public.local_day_start(v_day - (i + 1)) + make_interval(hours => 9 + (i % 8));
    v_service := v_services[1 + (i % array_length(v_services, 1))];
    select base_price into v_price from public.services where id = v_service;
    v_appt := public.create_appointment(
      p_staff_id => v_staff[1 + (i % array_length(v_staff, 1))],
      p_starts_at => v_start,
      p_service_ids => array[v_service],
      p_customer_id => v_customers[1 + (i % 10)],
      p_channel => (array['whatsapp', 'instagram', 'presencial'])[1 + (i % 3)],
      p_status => 'confirmada',
      p_allow_outside_hours => true);
    v_sale := public.complete_appointment(
      p_appointment_id => v_appt,
      p_items => jsonb_build_array(jsonb_build_object('kind', 'servicio', 'service_id', v_service, 'unit_price', v_price)),
      p_payment_method_id => v_payments[1 + (i % 4)],
      p_discount => case when i % 5 = 0 then 5000 else 0 end);
    -- Fecha histórica coherente con la cita (solo demo).
    update public.sales set sold_at = v_start + interval '1 hour' where id = (v_sale ->> 'sale_id')::uuid;
    update public.commission_records set created_at = v_start + interval '1 hour' where sale_id = (v_sale ->> 'sale_id')::uuid;
    update public.appointments set started_at = v_start, finished_at = v_start + interval '1 hour' where id = v_appt;
  end loop;

  -- 5 citas para hoy
  for i in 1..5 loop
    perform public.create_appointment(
      p_staff_id => v_staff[1 + (i % array_length(v_staff, 1))],
      p_starts_at => public.local_day_start(v_day) + make_interval(hours => 9 + i * 2),
      p_service_ids => array[v_services[1 + (i % array_length(v_services, 1))]],
      p_customer_id => v_customers[i],
      p_channel => 'whatsapp',
      p_status => case when i % 2 = 0 then 'confirmada' else 'pendiente' end,
      p_notes => 'DEMO',
      p_allow_outside_hours => true);
  end loop;
end;
$$;

-- 10 esmaltes demo
insert into public.nail_polishes (brand, color_name, reference, polish_type, notes)
select v.brand, v.color, v.ref, v.kind, 'DEMO'
  from (values
    ('OPI', 'Bubble Bath', 'S86', 'semipermanente'),
    ('OPI', 'Funny Bunny', 'H22', 'semipermanente'),
    ('Masglo', 'Coqueta', '121', 'tradicional'),
    ('Masglo', 'Elegante', '64', 'tradicional'),
    ('Vogue', 'Rojo Pasión', '305', 'tradicional'),
    ('Kiara Sky', 'Nude Beige', 'G511', 'gel'),
    ('Kiara Sky', 'Latte', 'G620', 'gel'),
    ('DND', 'Milky White', '859', 'semipermanente'),
    ('DND', 'Taupe', '744', 'semipermanente'),
    ('Cuccio', 'Almond', '6047', 'semipermanente')
  ) as v(brand, color, ref, kind)
 where not exists (select 1 from public.nail_polishes where notes = 'DEMO');

select public.change_polish_status(id, 'por_acabarse', 'Queda poco', 'DEMO')
  from public.nail_polishes where notes = 'DEMO' and color_name = 'Bubble Bath' and status = 'activo';
select public.change_polish_status(id, 'perdido', 'No se encuentra', 'DEMO')
  from public.nail_polishes where notes = 'DEMO' and color_name = 'Rojo Pasión' and status = 'activo';

-- Inventario demo
do $$
begin
  if not exists (select 1 from public.inventory_items where name like '%(DEMO)') then
    perform public.create_inventory_item('Acetona (DEMO)', 'Insumos', 'botella', 2, 6, null, 15000);
    perform public.create_inventory_item('Algodón (DEMO)', 'Insumos', 'paquete', 3, 2, null, 8000);
    perform public.create_inventory_item('Limas (DEMO)', 'Herramientas', 'unidad', 20, 50, null, 1500);
    perform public.create_inventory_item('Pegante pestañas (DEMO)', 'Pestañas', 'unidad', 1, 0, null, 45000);
    perform public.create_inventory_item('Top coat (DEMO)', 'Uñas', 'unidad', 2, 4, null, 35000);
  end if;
end;
$$;

select set_config('request.jwt.claims', '', false);

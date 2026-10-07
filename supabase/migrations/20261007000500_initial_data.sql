-- =============================================================================
-- MILAN · Datos iniciales de configuración (producción)
-- Idempotente: no sobrescribe valores que ya hayan sido editados en la app.
-- =============================================================================

-- Roles -----------------------------------------------------------------------
insert into public.roles (key, name, description, is_admin) values
  ('admin', 'Administración', 'Acceso completo', true),
  ('colaboradora', 'Colaboradora', 'Agenda propia, cierre de servicios y reportes de inventario', false)
on conflict (key) do nothing;

-- Permisos (los roles con is_admin los tienen todos) ---------------------------
insert into public.permissions (key, description) values
  ('dashboard.view', 'Ver dashboard administrativo'),
  ('appointments.read_all', 'Ver la agenda de todo el equipo'),
  ('appointments.manage_all', 'Crear, modificar y cancelar cualquier cita'),
  ('appointments.create', 'Crear citas (y modificar las propias)'),
  ('customers.read_all', 'Ver todas las clientas e historial completo'),
  ('customers.manage', 'Crear y editar clientas'),
  ('sales.create', 'Cerrar servicios propios y registrar la venta'),
  ('sales.read_all', 'Ver todas las ventas y la caja'),
  ('sales.manage', 'Modificar y anular ventas'),
  ('commissions.read_all', 'Ver comisiones de todo el equipo'),
  ('commissions.manage', 'Configurar porcentajes y pagar comisiones'),
  ('inventory.manage', 'Administrar inventario (entradas, ajustes, productos)'),
  ('inventory.report', 'Reportar salidas, pérdidas y daños de inventario'),
  ('polishes.manage', 'Administrar esmaltes'),
  ('polishes.report', 'Reportar estado de esmaltes'),
  ('services.manage', 'Administrar servicios y precios'),
  ('users.manage', 'Administrar usuarios y equipo'),
  ('settings.manage', 'Modificar configuración del negocio'),
  ('whatsapp.manage', 'Ver y tomar conversaciones de WhatsApp'),
  ('audit.read', 'Consultar auditoría')
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_key)
select r.id, p.key
  from public.roles r
  cross join (values
    ('sales.create'),
    ('inventory.report'),
    ('polishes.report'),
    ('appointments.create')  -- Se puede desactivar desde Configuración.
  ) as p(key)
 where r.key = 'colaboradora'
on conflict do nothing;

-- Configuración del negocio ---------------------------------------------------
insert into public.business_settings (key, value, description) values
  ('business', jsonb_build_object(
      'name', 'MILAN',
      'address', null,
      'phone', null,
      'instagram', null,
      'timezone', 'America/Bogota',
      'currency', 'COP'
    ), 'Datos del negocio'),
  ('opening_hours', jsonb_build_object(
      '1', null,
      '2', jsonb_build_object('open', '09:00', 'close', '19:00'),
      '3', jsonb_build_object('open', '09:00', 'close', '19:00'),
      '4', jsonb_build_object('open', '09:00', 'close', '19:00'),
      '5', jsonb_build_object('open', '09:00', 'close', '19:00'),
      '6', jsonb_build_object('open', '09:00', 'close', '19:00'),
      '7', jsonb_build_object('open', '09:00', 'close', '19:00')
    ), 'Horario de atención (1 = lunes … 7 = domingo; null = cerrado)'),
  ('agenda', jsonb_build_object('slot_minutes', 30), 'Configuración de agenda'),
  ('commission', jsonb_build_object('base', 'neto'),
    'Base de comisión: neto = valor del servicio después de descuento; bruto = antes del descuento'),
  ('crm_rules', jsonb_build_object(
      'new_max_visits', 1,
      'recurring_min_visits', 2,
      'vip_window_days', 180,
      'vip_min_spent', 500000,
      'vip_min_visits', 6,
      'inactive_days', 90,
      'reactivation_default_days', 30,
      'reactivation_days', jsonb_build_object('UÑAS', 21, 'PESTAÑAS', 21, 'DEPILACIÓN', 30),
      'birthday_window_days', 15
    ), 'Reglas de segmentación CRM')
on conflict (key) do nothing;

-- Medios de pago ----------------------------------------------------------------
insert into public.payment_methods (name, sort_order) values
  ('Efectivo', 1), ('Nequi', 2), ('Daviplata', 3), ('Transferencia', 4), ('Otro', 5)
on conflict (name) do nothing;

-- Catálogo de servicios -------------------------------------------------------
-- Duraciones aproximadas: editables desde Servicios.
insert into public.service_categories (name, sort_order) values
  ('UÑAS', 1), ('PESTAÑAS', 2), ('DEPILACIÓN', 3)
on conflict (name) do nothing;

insert into public.services (category_id, name, base_price, price_is_from, duration_min, sort_order, description)
select c.id, v.name, v.price, v.is_from, v.duration, v.sort_order, v.description
  from (values
    ('UÑAS', 'Tradicional', 20000, false, 45, 1, null),
    ('UÑAS', 'Semipermanente manos', 45000, false, 60, 2, null),
    ('UÑAS', 'Semipermanente pies', 50000, false, 60, 3, null),
    ('UÑAS', 'Rubber', 60000, false, 90, 4, null),
    ('UÑAS', 'Soft Gel', 80000, false, 120, 5, null),
    ('UÑAS', 'Acrílicas', 90000, true, 150, 6, 'Precio desde largo 1'),
    ('UÑAS', 'Polygel', 90000, true, 150, 7, 'Precio desde largo 1'),
    ('UÑAS', 'Reparación de uña', 10000, false, 20, 8, null),
    ('PESTAÑAS', 'Pestañas clásicas', 65000, true, 120, 1, null),
    ('DEPILACIÓN', 'Cejas', 10000, false, 20, 1, null),
    ('DEPILACIÓN', 'Cejas con pigmento', 25000, false, 45, 2, null),
    ('DEPILACIÓN', 'Axilas', 15000, false, 20, 3, null),
    ('DEPILACIÓN', 'Bigote', 5000, false, 15, 4, null)
  ) as v(category, name, price, is_from, duration, sort_order, description)
  join public.service_categories c on c.name = v.category
on conflict (category_id, name) do nothing;

-- Extras: largo adicional para Acrílicas/Polygel; efectos para uñas.
insert into public.service_extras (name, price, service_id, sort_order)
select 'Largo adicional', 10000, s.id, 1
  from public.services s
 where s.name in ('Acrílicas', 'Polygel')
   and not exists (
     select 1 from public.service_extras e where e.service_id = s.id and e.name = 'Largo adicional');

insert into public.service_extras (name, price, category_id, sort_order)
select 'Efectos', 3000, c.id, 2
  from public.service_categories c
 where c.name = 'UÑAS'
   and not exists (
     select 1 from public.service_extras e where e.category_id = c.id and e.name = 'Efectos');

-- Equipo y comisiones -----------------------------------------------------------
insert into public.staff (display_name, color, sort_order)
select v.name, v.color, v.sort_order
  from (values ('Blanca', '#A8957B', 1), ('Liz', '#BCAA8E', 2)) as v(name, color, sort_order)
 where not exists (select 1 from public.staff s where s.display_name = v.name);

insert into public.commission_rules (staff_id, percent, effective_from)
select s.id, v.percent, '2026-01-01T00:00:00-05:00'::timestamptz
  from (values ('Blanca', 60.00), ('Liz', 40.00)) as v(name, percent)
  join public.staff s on s.display_name = v.name
 where not exists (select 1 from public.commission_rules r where r.staff_id = s.id);

-- Storage -------------------------------------------------------------------------
-- esmaltes: fotos de catálogo (lectura pública por URL).
-- referencias: diseños de clientas (privado, URLs firmadas).
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
      ('esmaltes', 'esmaltes', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/heic']),
      ('referencias', 'referencias', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
    on conflict (id) do nothing;

    execute 'drop policy if exists milan_storage_select on storage.objects';
    execute 'drop policy if exists milan_storage_insert on storage.objects';
    execute 'drop policy if exists milan_storage_delete on storage.objects';
    execute $p$create policy milan_storage_select on storage.objects for select to authenticated
      using (bucket_id in ('esmaltes', 'referencias') and (select public.is_active_member()))$p$;
    execute $p$create policy milan_storage_insert on storage.objects for insert to authenticated
      with check (bucket_id in ('esmaltes', 'referencias') and (select public.is_active_member()))$p$;
    execute $p$create policy milan_storage_delete on storage.objects for delete to authenticated
      using (bucket_id in ('esmaltes', 'referencias') and (select public.is_admin()))$p$;
  end if;
end;
$$;

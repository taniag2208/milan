-- =============================================================================
-- MILAN · Rol "Equipo (compartido)"
-- Usuario único que comparten las colaboradoras en el spa para agendar y
-- registrar ventas. Puede cerrar citas de cualquier profesional (eligiendo
-- quién atendió), pero NO ve ventas, caja, comisiones ni el dashboard.
-- Idempotente y no destructiva.
-- =============================================================================

insert into public.roles (key, name, description, is_admin) values
  ('equipo', 'Equipo (compartido)',
   'Agenda de todas, cierre de servicios y reportes; sin acceso a ventas, caja ni comisiones', false)
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_key)
select r.id, p.key
  from public.roles r
  cross join (values
    ('appointments.read_all'),
    ('appointments.manage_all'),
    ('appointments.create'),
    ('customers.read_all'),
    ('customers.manage'),
    ('sales.create'),
    ('inventory.report'),
    ('polishes.report')
  ) as p(key)
 where r.key = 'equipo'
on conflict do nothing;

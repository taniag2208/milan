-- =============================================================================
-- Rol "Equipo (compartido)": opera la agenda de todas y cierra ventas,
-- pero no puede leer ventas, comisiones ni el dashboard.
-- =============================================================================
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000e1', 'equipo@test');
insert into public.profiles (id, username, full_name, role_id)
select '00000000-0000-0000-0000-0000000000e1', 'equipo', 'Equipo', id from public.roles where key = 'equipo';

select pg_temp.login('00000000-0000-0000-0000-0000000000e1');

select pg_temp.assert((select count(*) from public.appointments) > 0, 'equipo ve la agenda de todas');
select pg_temp.assert((select count(*) from public.customers) > 0, 'equipo ve las clientas');

create temp table t_eq as
select public.create_appointment(
  (select liz from ctx), (select tue10 from ctx) + interval '1 day 2 hours', array[(select semi_manos from ctx)],
  null, '3207778899', 'Clienta Equipo') as id;
select public.set_appointment_status((select id from t_eq), 'en_servicio');

create temp table t_eq_sale as
select public.complete_appointment(
  (select id from t_eq),
  jsonb_build_array(jsonb_build_object('kind', 'servicio', 'service_id', (select semi_manos from ctx), 'unit_price', 45000)),
  (select nequi from ctx), 0, (select liz from ctx)) as r;
select pg_temp.assert(((select r from t_eq_sale) ->> 'commission_amount')::bigint = 18000,
  'equipo cierra la venta de Liz (comisión 40% = 18.000)');

select pg_temp.assert((select count(*) from public.sales) = 0, 'equipo NO ve ventas');
select pg_temp.assert((select count(*) from public.commission_records) = 0, 'equipo NO ve comisiones');
select pg_temp.assert_fails($$select public.dashboard_summary(current_date, current_date)$$, '42501', 'equipo NO ve el dashboard');
select pg_temp.assert_fails($$select * from public.commission_summary(current_date, current_date)$$, '42501', 'equipo NO consulta resumen de comisiones');
select pg_temp.assert_fails($$select public.void_sale(((select r from t_eq_sale) ->> 'sale_id')::uuid, 'x')$$, '42501', 'equipo NO anula ventas');
reset role;
select set_config('request.jwt.claims', '', false);

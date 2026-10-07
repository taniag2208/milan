-- =============================================================================
-- Pruebas de flujo de negocio y RLS (Postgres local con stub de Supabase)
-- =============================================================================

-- Usuarios de prueba ------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@test'),
  ('00000000-0000-0000-0000-00000000000b', 'blanca@test'),
  ('00000000-0000-0000-0000-00000000000c', 'liz@test'),
  ('00000000-0000-0000-0000-00000000000d', 'intrusa@test');

insert into public.profiles (id, username, full_name, role_id)
select '00000000-0000-0000-0000-00000000000a', 'admin', 'Admin', id from public.roles where key = 'admin';
insert into public.profiles (id, username, full_name, role_id)
select '00000000-0000-0000-0000-00000000000b', 'blanca', 'Blanca', id from public.roles where key = 'colaboradora';
insert into public.profiles (id, username, full_name, role_id)
select '00000000-0000-0000-0000-00000000000c', 'liz', 'Liz', id from public.roles where key = 'colaboradora';
-- 'intrusa' es un usuario autenticado SIN perfil (p. ej. registro público).

update public.staff set profile_id = '00000000-0000-0000-0000-00000000000b' where display_name = 'Blanca';
update public.staff set profile_id = '00000000-0000-0000-0000-00000000000c' where display_name = 'Liz';

create or replace function pg_temp.login(p_user text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated')::text, false);
  execute 'set role authenticated';
end;
$$;

create or replace function pg_temp.assert(p_cond boolean, p_msg text) returns void language plpgsql as $$
begin
  if not coalesce(p_cond, false) then
    raise exception 'FALLÓ: %', p_msg;
  end if;
  raise notice 'ok · %', p_msg;
end;
$$;

-- Ejecuta SQL y verifica que falle con el código esperado.
create or replace function pg_temp.assert_fails(p_sql text, p_code text, p_msg text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if p_code is null or sqlstate = p_code then
      raise notice 'ok · % (falló como se esperaba: %)', p_msg, sqlerrm;
      return;
    end if;
    raise exception 'FALLÓ: % — código % (%), se esperaba %', p_msg, sqlstate, sqlerrm, p_code;
  end;
  raise exception 'FALLÓ: % — no generó error', p_msg;
end;
$$;

set client_min_messages = notice;

-- Próximo martes a las 10:00 (abierto), y próximo lunes (cerrado).
create temp table ctx as
select
  public.local_day_start(d.tue) + interval '10 hours' as tue10,
  public.local_day_start(d.tue + 6) + interval '10 hours' as mon10,
  (select id from public.staff where display_name = 'Blanca') as blanca,
  (select id from public.staff where display_name = 'Liz') as liz,
  (select id from public.services where name = 'Semipermanente manos') as semi_manos,
  (select id from public.services where name = 'Acrílicas') as acrilicas,
  (select id from public.service_extras where name = 'Largo adicional' limit 1) as largo,
  (select id from public.payment_methods where name = 'Nequi') as nequi
from (
  select (now() at time zone 'America/Bogota')::date
         + ((9 - extract(isodow from now() at time zone 'America/Bogota')::int) % 7 + 7) as tue
) d;
grant select on ctx to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 1. Anónimos e intrusos no ven nada
-- ---------------------------------------------------------------------------
set role anon;
select pg_temp.assert_fails('select * from public.services', '42501', 'anon no puede leer servicios');
reset role;

select pg_temp.login('00000000-0000-0000-0000-00000000000d');
select pg_temp.assert((select count(*) from public.services) = 0, 'usuario sin perfil no ve servicios');
select pg_temp.assert_fails(
  $$select public.create_appointment((select blanca from ctx), (select tue10 from ctx), array[(select semi_manos from ctx)], null, '3000000000', 'X')$$,
  '42501', 'usuario sin perfil no crea citas');
reset role;

-- ---------------------------------------------------------------------------
-- 2. Agenda + CRM sin duplicados (admin)
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000a');

create temp table t_appt as
select public.create_appointment(
  (select blanca from ctx), (select tue10 from ctx), array[(select semi_manos from ctx)],
  null, '300 123 4567', 'Ana  Pérez', 'whatsapp', 'Nota', 'Francesa', null, 'confirmada') as id;

select pg_temp.assert(
  (select phone_e164 from public.customers where full_name = 'Ana Pérez') = '+573001234567',
  'teléfono normalizado a E.164 y nombre limpiado');

select pg_temp.assert(
  (select ends_at - starts_at from public.appointments where id = (select id from t_appt)) = interval '60 minutes',
  'hora fin calculada desde la duración del servicio');

-- Mismo teléfono con otro formato y otro nombre → misma clienta.
create temp table t_appt2 as
select public.create_appointment(
  (select liz from ctx), (select tue10 from ctx), array[(select semi_manos from ctx)],
  null, '+57 300-123-4567', 'Anita P') as id;
select pg_temp.assert((select count(*) from public.customers where phone_e164 = '+573001234567') = 1,
  'no se duplica la clienta por diferencias de nombre');
select pg_temp.assert(
  (select customer_id from public.appointments where id = (select id from t_appt2))
  = (select customer_id from public.appointments where id = (select id from t_appt)),
  'la segunda cita queda asociada a la misma clienta');

select pg_temp.assert_fails(
  $$select public.create_appointment((select blanca from ctx), (select tue10 from ctx) + interval '30 minutes', array[(select semi_manos from ctx)], null, '3009999999', 'Otra')$$,
  '23P01', 'no permite citas cruzadas para la misma profesional');

select pg_temp.assert_fails(
  $$select public.create_appointment((select blanca from ctx), (select mon10 from ctx), array[(select semi_manos from ctx)], null, '3009999999', 'Otra')$$,
  'P0001', 'no permite citas en lunes (cerrado)');

select pg_temp.assert(
  (select count(*) from public.get_available_slots(((select tue10 from ctx) at time zone 'America/Bogota')::date,
     array[(select semi_manos from ctx)], (select blanca from ctx))
   where starts_at = (select tue10 from ctx)) = 0,
  'get_available_slots no ofrece un horario ocupado');
select pg_temp.assert(
  (select count(*) from public.get_available_slots(((select tue10 from ctx) at time zone 'America/Bogota')::date,
     array[(select semi_manos from ctx)], (select blanca from ctx))) > 0,
  'get_available_slots ofrece horarios libres');
reset role;

-- ---------------------------------------------------------------------------
-- 3. Colaboradora: ve solo lo suyo
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000c'); -- Liz
select pg_temp.assert((select count(*) from public.appointments where id = (select id from t_appt)) = 0,
  'Liz no ve citas de Blanca');
select pg_temp.assert((select count(*) from public.appointments where id = (select id from t_appt2)) = 1,
  'Liz ve sus propias citas');
select pg_temp.assert_fails(
  $$select public.set_appointment_status((select id from t_appt), 'en_servicio')$$,
  '42501', 'Liz no puede iniciar una cita de Blanca');
select pg_temp.assert_fails(
  $$insert into public.sales (staff_id, services_total, total, payment_method_id) values ((select liz from ctx), 1, 1, (select nequi from ctx))$$,
  '42501', 'nadie inserta ventas directamente');
reset role;

-- ---------------------------------------------------------------------------
-- 4. Flujo completo: iniciar → finalizar → venta → comisión (Blanca 60%)
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000b'); -- Blanca
select public.set_appointment_status((select id from t_appt), 'en_servicio');
select pg_temp.assert((select status from public.appointments where id = (select id from t_appt)) = 'en_servicio',
  'Blanca inicia su servicio');

-- 45.000 (servicio, cobrado 45.000) + extra efecto 5.000 − descuento 5.000 = 45.000
create temp table t_sale as
select public.complete_appointment(
  (select id from t_appt),
  jsonb_build_array(
    jsonb_build_object('kind', 'servicio', 'service_id', (select semi_manos from ctx), 'unit_price', 45000),
    jsonb_build_object('kind', 'extra', 'description', 'Diseño', 'unit_price', 5000)
  ),
  (select nequi from ctx),
  5000) as r;

select pg_temp.assert(((select r from t_sale) ->> 'total')::bigint = 45000, 'total = 45.000');
select pg_temp.assert(((select r from t_sale) ->> 'commission_percent')::numeric = 60, 'porcentaje aplicado 60%');
select pg_temp.assert(((select r from t_sale) ->> 'commission_amount')::bigint = 27000,
  'comisión 60% sobre 45.000 neto = 27.000');
select pg_temp.assert((select status from public.appointments where id = (select id from t_appt)) = 'finalizada',
  'la cita queda finalizada');
select pg_temp.assert_fails(
  $$select public.complete_appointment((select id from t_appt), '[{"kind":"servicio","service_id":"00000000-0000-0000-0000-000000000000","unit_price":1}]', (select nequi from ctx))$$,
  'P0001', 'no se puede cerrar dos veces la misma cita');
-- Sin política UPDATE, RLS ignora la modificación (0 filas).
update public.sales set discount = 0, total = 50000 where id = ((select r from t_sale) ->> 'sale_id')::uuid;
select pg_temp.assert(
  (select count(*) from public.sales where id = ((select r from t_sale) ->> 'sale_id')::uuid and total = 45000) = 1,
  'colaboradora no puede modificar ventas (sigue intacta)');
select pg_temp.assert(
  (select count(*) from public.commission_summary(current_date - 1, current_date + 30)) = 1,
  'colaboradora solo ve su propio resumen de comisiones');
select pg_temp.assert_fails($$select public.dashboard_summary(current_date, current_date)$$, '42501',
  'colaboradora no ve el dashboard financiero');
select pg_temp.assert_fails($$select public.set_commission_percent((select blanca from ctx), 90)$$, '42501',
  'colaboradora no cambia porcentajes');
reset role;

select pg_temp.login('00000000-0000-0000-0000-00000000000c'); -- Liz
select pg_temp.assert((select count(*) from public.sales) = 0, 'Liz no ve ventas de Blanca');
select pg_temp.assert((select count(*) from public.commission_records) = 0, 'Liz no ve comisiones de Blanca');
reset role;

-- ---------------------------------------------------------------------------
-- 5. Cambio de porcentaje no altera históricos; anulación
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select public.set_commission_percent((select blanca from ctx), 70);
select pg_temp.assert(
  (select percent from public.commission_records where sale_id = ((select r from t_sale) ->> 'sale_id')::uuid) = 60,
  'el registro histórico conserva 60%');
select pg_temp.assert(public.current_commission_percent((select blanca from ctx)) = 70, 'nuevo porcentaje vigente 70%');
select pg_temp.assert((select count(*) from public.audit_logs where entity = 'commission_rules') >= 1,
  'cambio de comisión auditado');

select pg_temp.assert(((public.dashboard_summary(current_date - 30, current_date + 30)) ->> 'sales_total')::bigint >= 45000,
  'dashboard suma ventas');
select pg_temp.assert(
  (select visits from public.customer_stats cs join public.customers c on c.id = cs.customer_id
    where c.phone_e164 = '+573001234567') = 1,
  'historial de clienta actualizado (1 visita)');
select pg_temp.assert(
  (select 'nueva' = any (segments) from public.customer_segments cs join public.customers c on c.id = cs.customer_id
    where c.phone_e164 = '+573001234567'),
  'segmento "nueva" calculado');

select public.void_sale(((select r from t_sale) ->> 'sale_id')::uuid, 'Error de cobro');
select pg_temp.assert((select status from public.appointments where id = (select id from t_appt)) = 'en_servicio',
  'al anular, la cita vuelve a "en servicio"');
select pg_temp.assert(
  (select status from public.commission_records where sale_id = ((select r from t_sale) ->> 'sale_id')::uuid) = 'anulada',
  'al anular, la comisión queda anulada');
select pg_temp.assert((select count(*) from public.audit_logs where action = 'sale.void') = 1, 'anulación auditada');

-- Volver a cerrar tras anular (nuevo porcentaje 70%)
select pg_temp.assert(
  (public.complete_appointment((select id from t_appt),
     jsonb_build_array(jsonb_build_object('kind', 'servicio', 'service_id', (select semi_manos from ctx), 'unit_price', 45000)),
     (select nequi from ctx)) ->> 'commission_amount')::bigint = 31500,
  'se puede cerrar de nuevo tras anular (70% de 45.000 = 31.500)');

-- Acrílicas con largo adicional: el extra toma nombre/precio de catálogo
select public.set_appointment_status((select id from t_appt2), 'en_servicio');
select pg_temp.assert(
  (public.complete_appointment((select id from t_appt2),
     jsonb_build_array(
       jsonb_build_object('kind', 'servicio', 'service_id', (select acrilicas from ctx), 'unit_price', 90000),
       jsonb_build_object('kind', 'extra', 'extra_id', (select largo from ctx), 'unit_price', 10000, 'quantity', 2)),
     (select nequi from ctx)) ->> 'total')::bigint = 110000,
  'acrílicas + 2 largos adicionales = 110.000');
reset role;

-- ---------------------------------------------------------------------------
-- 6. Inventario: sin cambios silenciosos
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
create temp table t_item as select public.create_inventory_item('Acetona', 'Insumos', 'botella', 2, 5) as id;
select pg_temp.assert((select quantity from public.inventory_items where id = (select id from t_item)) = 5,
  'stock inicial registrado como movimiento');
select pg_temp.assert_fails(
  $$update public.inventory_items set quantity = 100 where id = (select id from t_item)$$,
  '42501', 'no se puede cambiar el stock sin movimiento');
reset role;

select pg_temp.login('00000000-0000-0000-0000-00000000000c'); -- Liz
select public.register_inventory_movement((select id from t_item), 'salida', 4, null, 'Uso diario');
select pg_temp.assert((select stock_status from public.inventory_items where id = (select id from t_item)) = 'stock_bajo',
  'salida de colaboradora → stock bajo');
select pg_temp.assert_fails(
  $$select public.register_inventory_movement((select id from t_item), 'salida', 10)$$,
  'P0001', 'no permite stock negativo');
select pg_temp.assert_fails(
  $$select public.register_inventory_movement((select id from t_item), 'entrada', 10)$$,
  '42501', 'colaboradora no registra entradas');
select pg_temp.assert_fails(
  $$select public.register_inventory_movement((select id from t_item), 'perdida', 1)$$,
  '22023', 'pérdida exige motivo');
select public.register_inventory_movement((select id from t_item), 'perdida', 1, 'Se derramó');
select pg_temp.assert((select stock_status from public.inventory_items where id = (select id from t_item)) = 'agotado',
  'pérdida → agotado');
select pg_temp.assert((select count(*) from public.inventory_movements where item_id = (select id from t_item)) = 3,
  'cada cambio generó movimiento (3)');
reset role;

-- ---------------------------------------------------------------------------
-- 7. Esmaltes: reporte con historial y auditoría
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into public.nail_polishes (brand, color_name, reference) values ('OPI', 'Test', 'T1');
reset role;

select pg_temp.login('00000000-0000-0000-0000-00000000000c'); -- Liz
select public.change_polish_status((select id from public.nail_polishes where color_name = 'Test'), 'perdido', 'No aparece', 'Revisé cajón');
select pg_temp.assert((select status from public.nail_polishes where color_name = 'Test') = 'perdido',
  'colaboradora reporta esmalte perdido');
select pg_temp.assert(
  (select count(*) from public.nail_polish_status_history h join public.nail_polishes p on p.id = h.polish_id
    where p.color_name = 'Test') = 2,
  'historial: ingreso + perdido');
select pg_temp.assert(
  (select changed_by from public.nail_polish_status_history h join public.nail_polishes p on p.id = h.polish_id
    where p.color_name = 'Test' and h.to_status = 'perdido') = '00000000-0000-0000-0000-00000000000c',
  'historial registra quién reportó');
select pg_temp.assert_fails(
  $$select public.change_polish_status((select id from public.nail_polishes where color_name = 'Test'), 'dado_de_baja')$$,
  '42501', 'colaboradora no da de baja esmaltes');
update public.nail_polishes set status = 'activo' where color_name = 'Test';
select pg_temp.assert((select status from public.nail_polishes where color_name = 'Test') = 'perdido',
  'colaboradora no cambia estado directamente');
reset role;

select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select pg_temp.assert_fails(
  $$update public.nail_polishes set status = 'activo' where color_name = 'Test'$$,
  '42501', 'ni administración cambia estado sin historial');
select pg_temp.assert((select count(*) from public.audit_logs where action = 'polish.perdido') >= 1,
  'esmalte perdido auditado');
select pg_temp.assert((select count(*) from public.audit_logs where action = 'inventory.perdida') = 1,
  'pérdida de inventario auditada');
reset role;

-- ---------------------------------------------------------------------------
-- 8. Configuración: colaboradora no modifica
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
update public.business_settings set value = '{}' where key = 'agenda';
select pg_temp.assert((select value from public.business_settings where key = 'agenda') <> '{}'::jsonb,
  'colaboradora no modifica configuración');
update public.services set base_price = 1 where name = 'Tradicional';
select pg_temp.assert((select base_price from public.services where name = 'Tradicional') = 20000,
  'colaboradora no modifica precios');
select pg_temp.assert((select count(*) from public.audit_logs) = 0, 'colaboradora no lee auditoría');
reset role;

-- Service role (servidor) puede consultar disponibilidad para el agente.
select set_config('request.jwt.claims', '{"role":"service_role"}', false);
set role service_role;
select pg_temp.assert(
  (select count(*) from public.get_available_slots(((select tue10 from ctx) at time zone 'America/Bogota')::date,
     array[(select semi_manos from ctx)])) > 0,
  'service role consulta disponibilidad');
reset role;
select set_config('request.jwt.claims', '', false);

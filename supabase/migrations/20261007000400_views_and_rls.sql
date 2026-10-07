-- =============================================================================
-- MILAN · Vistas CRM + Row Level Security
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Vistas (security_invoker: respetan el RLS de quien consulta)
-- -----------------------------------------------------------------------------

create or replace view public.customer_stats
with (security_invoker = true) as
select
  c.id as customer_id,
  min(s.sold_at) as first_visit_at,
  max(s.sold_at) as last_visit_at,
  count(s.id) as visits,
  coalesce(sum(s.total), 0)::bigint as total_spent,
  (
    select si.description
      from public.sale_items si
      join public.sales s2 on s2.id = si.sale_id
     where s2.customer_id = c.id and s2.status = 'registrada' and si.kind = 'servicio'
     group by si.description
     order by count(*) desc, max(s2.sold_at) desc
     limit 1
  ) as favorite_service,
  (
    select st.display_name
      from public.sales s3
      join public.staff st on st.id = s3.staff_id
     where s3.customer_id = c.id and s3.status = 'registrada'
     group by st.display_name
     order by count(*) desc, max(s3.sold_at) desc
     limit 1
  ) as usual_staff
from public.customers c
left join public.sales s on s.customer_id = c.id and s.status = 'registrada'
group by c.id;

-- Segmentos automáticos. Reglas en business_settings.crm_rules (configurables).
create or replace view public.customer_segments
with (security_invoker = true) as
with rules as (
  select coalesce(public.get_setting('crm_rules'), '{}'::jsonb) as r
),
base as (
  select
    c.id as customer_id,
    c.birth_date,
    cs.visits,
    cs.last_visit_at,
    (now() at time zone 'America/Bogota')::date - (cs.last_visit_at at time zone 'America/Bogota')::date as days_since_last,
    (
      select coalesce(sum(s.total), 0)
        from public.sales s, rules
       where s.customer_id = c.id and s.status = 'registrada'
         and s.sold_at >= now() - make_interval(days => coalesce((rules.r ->> 'vip_window_days')::int, 180))
    ) as window_spent,
    (
      select count(*)
        from public.sales s, rules
       where s.customer_id = c.id and s.status = 'registrada'
         and s.sold_at >= now() - make_interval(days => coalesce((rules.r ->> 'vip_window_days')::int, 180))
    ) as window_visits,
    (
      select sc.name
        from public.sales s
        join public.sale_items si on si.sale_id = s.id and si.kind = 'servicio'
        join public.services sv on sv.id = si.service_id
        join public.service_categories sc on sc.id = sv.category_id
       where s.customer_id = c.id and s.status = 'registrada'
       order by s.sold_at desc
       limit 1
    ) as last_category
  from public.customers c
  join public.customer_stats cs on cs.customer_id = c.id
)
select
  b.customer_id,
  array_remove(array[
    case when b.visits between 1 and coalesce((rules.r ->> 'new_max_visits')::int, 1) then 'nueva' end,
    case when b.visits >= coalesce((rules.r ->> 'recurring_min_visits')::int, 2) then 'recurrente' end,
    case when b.window_spent >= coalesce((rules.r ->> 'vip_min_spent')::bigint, 500000)
           or b.window_visits >= coalesce((rules.r ->> 'vip_min_visits')::int, 6) then 'vip' end,
    case when b.days_since_last > coalesce((rules.r ->> 'inactive_days')::int, 90) then 'inactiva' end,
    case when b.days_since_last > coalesce(
                (rules.r -> 'reactivation_days' ->> b.last_category)::int,
                (rules.r ->> 'reactivation_default_days')::int, 30)
          and b.days_since_last <= coalesce((rules.r ->> 'inactive_days')::int, 90) then 'por_reactivar' end,
    case when b.birth_date is not null
          and (
            -- Próximo cumpleaños (hoy incluido); 29-feb cae el 28 en años no bisiestos.
            (b.birth_date + make_interval(years => extract(year from age(
               (now() at time zone 'America/Bogota')::date - 1, b.birth_date))::int + 1))::date
            - (now() at time zone 'America/Bogota')::date
          ) between 0 and coalesce((rules.r ->> 'birthday_window_days')::int, 15) then 'cumpleanos_proximo' end
  ], null) as segments
from base b, rules;

-- -----------------------------------------------------------------------------
-- RLS: se activa en todas las tablas. Las escrituras sensibles pasan por RPC.
-- -----------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'roles', 'permissions', 'role_permissions', 'profiles', 'staff',
    'business_settings', 'payment_methods', 'service_categories', 'services',
    'service_extras', 'customers', 'appointments', 'appointment_services',
    'sales', 'sale_items', 'commission_rules', 'commission_records',
    'inventory_items', 'inventory_movements', 'nail_polishes',
    'nail_polish_status_history', 'whatsapp_contacts', 'whatsapp_conversations',
    'whatsapp_conversation_events', 'whatsapp_messages', 'whatsapp_webhook_events',
    'audit_logs'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end;
$$;

-- Helper: ¿la clienta tiene citas con la profesional actual?
create or replace function public.is_my_customer(p_customer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.appointments a
     where a.customer_id = p_customer_id
       and a.staff_id = public.current_staff_id()
  );
$$;

-- Limpieza idempotente de políticas propias antes de recrearlas.
do $$
declare
  pol record;
begin
  for pol in
    select schemaname, tablename, policyname
      from pg_policies
     where schemaname = 'public' and policyname like 'milan_%'
  loop
    execute format('drop policy %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  end loop;
end;
$$;

-- Roles y permisos
create policy milan_roles_select on public.roles for select to authenticated
  using ((select public.is_active_member()));
create policy milan_roles_write on public.roles for all to authenticated
  using ((select public.has_permission('users.manage'))) with check ((select public.has_permission('users.manage')));

create policy milan_permissions_select on public.permissions for select to authenticated
  using ((select public.is_active_member()));

create policy milan_role_permissions_select on public.role_permissions for select to authenticated
  using ((select public.is_active_member()));
create policy milan_role_permissions_write on public.role_permissions for all to authenticated
  using ((select public.has_permission('settings.manage'))) with check ((select public.has_permission('settings.manage')));

-- Perfiles: cada quien ve el suyo; administración ve todos.
create policy milan_profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or (select public.has_permission('users.manage')));
create policy milan_profiles_update on public.profiles for update to authenticated
  using ((select public.has_permission('users.manage'))) with check ((select public.has_permission('users.manage')));

-- Equipo: visible para todo el equipo (agenda, selector "quién atendió").
create policy milan_staff_select on public.staff for select to authenticated
  using ((select public.is_active_member()));
create policy milan_staff_write on public.staff for all to authenticated
  using ((select public.has_permission('users.manage'))) with check ((select public.has_permission('users.manage')));

-- Configuración
create policy milan_settings_select on public.business_settings for select to authenticated
  using ((select public.is_active_member()));
create policy milan_settings_write on public.business_settings for all to authenticated
  using ((select public.has_permission('settings.manage'))) with check ((select public.has_permission('settings.manage')));

create policy milan_payment_methods_select on public.payment_methods for select to authenticated
  using ((select public.is_active_member()));
create policy milan_payment_methods_write on public.payment_methods for all to authenticated
  using ((select public.has_permission('settings.manage'))) with check ((select public.has_permission('settings.manage')));

-- Catálogo
create policy milan_service_categories_select on public.service_categories for select to authenticated
  using ((select public.is_active_member()));
create policy milan_service_categories_write on public.service_categories for all to authenticated
  using ((select public.has_permission('services.manage'))) with check ((select public.has_permission('services.manage')));

create policy milan_services_select on public.services for select to authenticated
  using ((select public.is_active_member()));
create policy milan_services_write on public.services for all to authenticated
  using ((select public.has_permission('services.manage'))) with check ((select public.has_permission('services.manage')));

create policy milan_service_extras_select on public.service_extras for select to authenticated
  using ((select public.is_active_member()));
create policy milan_service_extras_write on public.service_extras for all to authenticated
  using ((select public.has_permission('services.manage'))) with check ((select public.has_permission('services.manage')));

-- Clientes: administración ve todas; colaboradora solo las que atiende.
create policy milan_customers_select on public.customers for select to authenticated
  using ((select public.has_permission('customers.read_all')) or public.is_my_customer(id));
create policy milan_customers_insert on public.customers for insert to authenticated
  with check ((select public.has_permission('customers.manage')));
create policy milan_customers_update on public.customers for update to authenticated
  using ((select public.has_permission('customers.manage'))) with check ((select public.has_permission('customers.manage')));

-- Agenda: lectura según alcance; escrituras solo vía RPC.
create policy milan_appointments_select on public.appointments for select to authenticated
  using ((select public.has_permission('appointments.read_all')) or staff_id = (select public.current_staff_id()));

create policy milan_appointment_services_select on public.appointment_services for select to authenticated
  using (exists (select 1 from public.appointments a where a.id = appointment_id));

-- Ventas: administración ve todas; colaboradora solo las suyas. Sin escritura directa.
create policy milan_sales_select on public.sales for select to authenticated
  using ((select public.has_permission('sales.read_all')) or staff_id = (select public.current_staff_id()));

create policy milan_sale_items_select on public.sale_items for select to authenticated
  using (exists (select 1 from public.sales s where s.id = sale_id));

-- Comisiones
create policy milan_commission_rules_select on public.commission_rules for select to authenticated
  using ((select public.has_permission('commissions.read_all')) or staff_id = (select public.current_staff_id()));

create policy milan_commission_records_select on public.commission_records for select to authenticated
  using ((select public.has_permission('commissions.read_all')) or staff_id = (select public.current_staff_id()));

-- Inventario: todo el equipo consulta; datos maestros solo administración.
create policy milan_inventory_items_select on public.inventory_items for select to authenticated
  using ((select public.is_active_member()));
create policy milan_inventory_items_update on public.inventory_items for update to authenticated
  using ((select public.has_permission('inventory.manage'))) with check ((select public.has_permission('inventory.manage')));

create policy milan_inventory_movements_select on public.inventory_movements for select to authenticated
  using ((select public.is_active_member()));

-- Esmaltes
create policy milan_nail_polishes_select on public.nail_polishes for select to authenticated
  using ((select public.is_active_member()));
create policy milan_nail_polishes_insert on public.nail_polishes for insert to authenticated
  with check ((select public.has_permission('polishes.manage')));
create policy milan_nail_polishes_update on public.nail_polishes for update to authenticated
  using ((select public.has_permission('polishes.manage'))) with check ((select public.has_permission('polishes.manage')));

create policy milan_nail_polish_history_select on public.nail_polish_status_history for select to authenticated
  using ((select public.is_active_member()));

-- WhatsApp: solo administración. La escritura entrante la hace el servidor (service role).
create policy milan_wa_contacts_select on public.whatsapp_contacts for select to authenticated
  using ((select public.has_permission('whatsapp.manage')));
create policy milan_wa_conversations_select on public.whatsapp_conversations for select to authenticated
  using ((select public.has_permission('whatsapp.manage')));
create policy milan_wa_conv_events_select on public.whatsapp_conversation_events for select to authenticated
  using ((select public.has_permission('whatsapp.manage')));
create policy milan_wa_messages_select on public.whatsapp_messages for select to authenticated
  using ((select public.has_permission('whatsapp.manage')));
create policy milan_wa_webhook_events_select on public.whatsapp_webhook_events for select to authenticated
  using ((select public.has_permission('whatsapp.manage')));

-- Auditoría: solo lectura para quien tenga permiso; nadie escribe directo.
create policy milan_audit_logs_select on public.audit_logs for select to authenticated
  using ((select public.has_permission('audit.read')));

-- -----------------------------------------------------------------------------
-- Privilegios: anon no accede a nada; funciones internas no son invocables.
-- -----------------------------------------------------------------------------

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;

-- Funciones internas: nunca llamables directamente desde el cliente.
revoke execute on function public.resolve_customer(uuid, text, text, text) from authenticated;
revoke execute on function public.log_audit(text, text, text, jsonb) from authenticated;
revoke execute on function public.audit_row_change() from authenticated;
revoke execute on function public.nail_polishes_initial_history() from authenticated;

alter default privileges in schema public revoke execute on functions from public, anon;
alter default privileges in schema public revoke all on tables from anon;

-- =============================================================================
-- MILAN · Esquema base
-- Convenciones:
--   * UUID como llave primaria.
--   * Dinero en pesos colombianos enteros (bigint), sin decimales.
--   * Fechas como timestamptz; el negocio opera en America/Bogota.
--   * Migración no destructiva: no elimina ni reemplaza tablas existentes.
-- =============================================================================

create extension if not exists btree_gist with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- Utilidades
-- -----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Normaliza un teléfono a formato E.164. Asume Colombia (+57) cuando no hay
-- indicativo. Devuelve null si el valor no parece un teléfono.
create or replace function public.normalize_phone(p_phone text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_digits text;
  v_has_plus boolean;
begin
  if p_phone is null then
    return null;
  end if;
  v_has_plus := left(btrim(p_phone), 1) = '+' or left(btrim(p_phone), 2) = '00';
  v_digits := regexp_replace(p_phone, '\D', '', 'g');
  if left(btrim(p_phone), 2) = '00' then
    v_digits := substr(v_digits, 3);
  end if;
  if length(v_digits) < 7 then
    return null;
  end if;
  if not v_has_plus then
    if length(v_digits) = 10 then
      return '+57' || v_digits;
    elsif length(v_digits) = 12 and left(v_digits, 2) = '57' then
      return '+' || v_digits;
    elsif length(v_digits) <= 10 then
      return '+57' || v_digits;
    end if;
  end if;
  return '+' || v_digits;
end;
$$;

-- -----------------------------------------------------------------------------
-- Roles y permisos (extensible: agregar filas, no código)
-- -----------------------------------------------------------------------------

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.permissions (
  key text primary key,
  description text not null
);

create table if not exists public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_key text not null references public.permissions(key) on delete cascade,
  primary key (role_id, permission_key)
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9._-]{3,32}$'),
  full_name text not null,
  role_id uuid not null references public.roles(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists profiles_role_id_idx on public.profiles(role_id);

-- Profesionales que atienden. Separado de profiles para permitir
-- profesionales sin acceso a la app.
create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles(id) on delete set null,
  display_name text not null,
  phone text,
  color text not null default '#BCAA8E',
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Configuración del negocio (clave/valor JSON)
-- -----------------------------------------------------------------------------

create table if not exists public.business_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Catálogo de servicios
-- -----------------------------------------------------------------------------

create table if not exists public.service_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.service_categories(id),
  name text not null,
  description text,
  base_price bigint not null check (base_price >= 0),
  price_is_from boolean not null default false,
  duration_min int not null check (duration_min > 0),
  commissionable boolean not null default true,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_id, name)
);
create index if not exists services_category_id_idx on public.services(category_id);

-- Extras: aplican a un servicio, a una categoría o a todo (ambos null).
create table if not exists public.service_extras (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price bigint not null check (price >= 0),
  service_id uuid references public.services(id) on delete cascade,
  category_id uuid references public.service_categories(id) on delete cascade,
  commissionable boolean not null default true,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Clientes (CRM). El teléfono normalizado es el identificador principal.
-- Las métricas (visitas, total gastado...) se derivan de ventas en vistas.
-- -----------------------------------------------------------------------------

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (length(btrim(full_name)) > 0),
  phone_e164 text unique,
  birth_date date,
  instagram text,
  source text not null default 'presencial'
    check (source in ('whatsapp', 'instagram', 'presencial', 'referido', 'otro')),
  notes text,
  status text not null default 'activa' check (status in ('activa', 'inactiva', 'bloqueada')),
  marketing_consent boolean not null default false,
  marketing_consent_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists customers_full_name_idx on public.customers(lower(full_name));
create index if not exists customers_created_at_idx on public.customers(created_at);

create or replace function public.customers_normalize()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.full_name := btrim(regexp_replace(new.full_name, '\s+', ' ', 'g'));
  if new.phone_e164 is not null then
    new.phone_e164 := public.normalize_phone(new.phone_e164);
    if new.phone_e164 is null then
      raise exception 'Teléfono inválido' using errcode = '22023';
    end if;
  end if;
  if new.instagram is not null then
    new.instagram := nullif(ltrim(btrim(new.instagram), '@'), '');
  end if;
  if new.marketing_consent and (tg_op = 'INSERT' or not old.marketing_consent) then
    new.marketing_consent_at := now();
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Agenda
-- -----------------------------------------------------------------------------

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id),
  staff_id uuid not null references public.staff(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'pendiente'
    check (status in ('pendiente', 'confirmada', 'en_servicio', 'finalizada', 'cancelada', 'no_asistio')),
  channel text not null default 'presencial'
    check (channel in ('whatsapp', 'instagram', 'presencial', 'referido', 'otro')),
  notes text,
  design_notes text,
  reference_image_path text,
  started_at timestamptz,
  finished_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_valid_range check (ends_at > starts_at),
  -- Una profesional no puede tener dos citas activas que se crucen.
  constraint appointments_no_overlap exclude using gist (
    staff_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status not in ('cancelada', 'no_asistio'))
);
create index if not exists appointments_starts_at_idx on public.appointments(starts_at);
create index if not exists appointments_staff_starts_idx on public.appointments(staff_id, starts_at);
create index if not exists appointments_customer_id_idx on public.appointments(customer_id);
create index if not exists appointments_status_idx on public.appointments(status);

create table if not exists public.appointment_services (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  service_id uuid not null references public.services(id),
  price bigint not null check (price >= 0),
  duration_min int not null check (duration_min > 0),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists appointment_services_appointment_idx on public.appointment_services(appointment_id);

-- -----------------------------------------------------------------------------
-- Ventas
-- -----------------------------------------------------------------------------

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references public.appointments(id),
  customer_id uuid references public.customers(id),
  staff_id uuid not null references public.staff(id),
  sold_at timestamptz not null default now(),
  services_total bigint not null check (services_total >= 0),
  extras_total bigint not null default 0 check (extras_total >= 0),
  discount bigint not null default 0 check (discount >= 0),
  total bigint not null check (total >= 0),
  payment_method_id uuid not null references public.payment_methods(id),
  status text not null default 'registrada' check (status in ('registrada', 'anulada')),
  notes text,
  void_reason text,
  voided_at timestamptz,
  voided_by uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sales_total_consistent check (total = services_total + extras_total - discount)
);
-- Una cita solo puede tener una venta vigente.
create unique index if not exists sales_appointment_active_uidx
  on public.sales(appointment_id) where status = 'registrada';
create index if not exists sales_sold_at_idx on public.sales(sold_at);
create index if not exists sales_staff_id_idx on public.sales(staff_id, sold_at);
create index if not exists sales_customer_id_idx on public.sales(customer_id);
create index if not exists sales_status_idx on public.sales(status);

create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  kind text not null check (kind in ('servicio', 'extra')),
  service_id uuid references public.services(id),
  extra_id uuid references public.service_extras(id),
  description text not null,
  list_price bigint not null default 0 check (list_price >= 0),
  unit_price bigint not null check (unit_price >= 0),
  quantity int not null default 1 check (quantity > 0),
  line_total bigint generated always as (unit_price * quantity) stored,
  commissionable boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists sale_items_sale_id_idx on public.sale_items(sale_id);
create index if not exists sale_items_service_id_idx on public.sale_items(service_id);

-- -----------------------------------------------------------------------------
-- Comisiones. Las reglas son históricas (effective_from); cada registro guarda
-- el porcentaje aplicado para que cambios futuros no alteren ventas pasadas.
-- -----------------------------------------------------------------------------

create table if not exists public.commission_rules (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete cascade,
  percent numeric(5, 2) not null check (percent >= 0 and percent <= 100),
  effective_from timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists commission_rules_staff_idx on public.commission_rules(staff_id, effective_from desc);

create table if not exists public.commission_records (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null unique references public.sales(id) on delete cascade,
  staff_id uuid not null references public.staff(id),
  base_amount bigint not null check (base_amount >= 0),
  percent numeric(5, 2) not null,
  commission_amount bigint not null check (commission_amount >= 0),
  business_amount bigint not null,
  status text not null default 'pendiente' check (status in ('pendiente', 'pagada', 'anulada')),
  paid_at timestamptz,
  paid_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists commission_records_staff_idx on public.commission_records(staff_id, created_at);
create index if not exists commission_records_status_idx on public.commission_records(status);

-- -----------------------------------------------------------------------------
-- Inventario general. La cantidad solo cambia mediante movimientos.
-- -----------------------------------------------------------------------------

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'General',
  unit text not null default 'unidad',
  quantity numeric(12, 2) not null default 0 check (quantity >= 0),
  min_stock numeric(12, 2) not null default 0 check (min_stock >= 0),
  supplier text,
  unit_cost bigint check (unit_cost >= 0),
  is_active boolean not null default true,
  stock_status text generated always as (
    case
      when quantity <= 0 then 'agotado'
      when quantity <= min_stock then 'stock_bajo'
      else 'disponible'
    end
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists inventory_items_status_idx on public.inventory_items(stock_status);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  movement_type text not null check (movement_type in ('entrada', 'salida', 'ajuste', 'perdida', 'dano')),
  quantity numeric(12, 2) not null check (quantity >= 0),
  delta numeric(12, 2) not null,
  quantity_before numeric(12, 2) not null,
  quantity_after numeric(12, 2) not null,
  reason text,
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists inventory_movements_item_idx on public.inventory_movements(item_id, created_at desc);
create index if not exists inventory_movements_created_at_idx on public.inventory_movements(created_at);

-- Impide cambios silenciosos de stock: solo las funciones de movimiento
-- habilitan esta bandera dentro de su transacción.
create or replace function public.inventory_items_guard_quantity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(current_setting('milan.stock_change', true), '') <> 'on' then
    if tg_op = 'INSERT' and new.quantity <> 0 then
      raise exception 'El stock inicial debe registrarse como movimiento de entrada' using errcode = '42501';
    elsif tg_op = 'UPDATE' and new.quantity is distinct from old.quantity then
      raise exception 'El stock solo puede cambiar mediante un movimiento de inventario' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Esmaltes (unidades identificables con historial de estado)
-- -----------------------------------------------------------------------------

create sequence if not exists public.nail_polish_code_seq;

create table if not exists public.nail_polishes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('E-' || lpad(nextval('public.nail_polish_code_seq')::text, 4, '0')),
  brand text not null,
  color_name text not null,
  reference text,
  polish_type text not null default 'semipermanente'
    check (polish_type in ('semipermanente', 'tradicional', 'gel', 'otro')),
  photo_path text,
  received_at date not null default (now() at time zone 'America/Bogota')::date,
  status text not null default 'activo'
    check (status in ('activo', 'en_uso', 'por_acabarse', 'terminado', 'danado', 'perdido', 'dado_de_baja')),
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists nail_polishes_status_idx on public.nail_polishes(status);

create table if not exists public.nail_polish_status_history (
  id uuid primary key default gen_random_uuid(),
  polish_id uuid not null references public.nail_polishes(id) on delete cascade,
  from_status text,
  to_status text not null,
  reason text,
  comment text,
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);
create index if not exists nail_polish_history_polish_idx on public.nail_polish_status_history(polish_id, changed_at desc);
create index if not exists nail_polish_history_changed_at_idx on public.nail_polish_status_history(changed_at);

create or replace function public.nail_polishes_guard_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(current_setting('milan.polish_status_change', true), '') <> 'on'
     and new.status is distinct from old.status then
    raise exception 'El estado del esmalte solo cambia mediante un reporte con historial' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- WhatsApp (Meta Cloud API oficial)
-- -----------------------------------------------------------------------------

create table if not exists public.whatsapp_contacts (
  id uuid primary key default gen_random_uuid(),
  wa_id text not null unique,
  phone_e164 text not null,
  profile_name text,
  customer_id uuid references public.customers(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists whatsapp_contacts_phone_idx on public.whatsapp_contacts(phone_e164);
create index if not exists whatsapp_contacts_customer_idx on public.whatsapp_contacts(customer_id);

create table if not exists public.whatsapp_conversations (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.whatsapp_contacts(id) on delete cascade,
  mode text not null default 'AI_ACTIVE' check (mode in ('AI_ACTIVE', 'HUMAN_ACTIVE', 'CLOSED')),
  assigned_to uuid references public.profiles(id) on delete set null,
  taken_at timestamptz,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Una sola conversación abierta por contacto.
create unique index if not exists whatsapp_conversations_open_uidx
  on public.whatsapp_conversations(contact_id) where mode <> 'CLOSED';
create index if not exists whatsapp_conversations_last_msg_idx on public.whatsapp_conversations(last_message_at desc);

create table if not exists public.whatsapp_conversation_events (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.whatsapp_conversations(id) on delete cascade,
  from_mode text,
  to_mode text not null,
  changed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists whatsapp_conv_events_conv_idx on public.whatsapp_conversation_events(conversation_id);

create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.whatsapp_conversations(id) on delete cascade,
  wa_message_id text unique,
  direction text not null check (direction in ('inbound', 'outbound')),
  sender text not null check (sender in ('customer', 'agent', 'human', 'system')),
  message_type text not null default 'text',
  body text,
  payload jsonb,
  status text not null default 'received'
    check (status in ('received', 'queued', 'sent', 'delivered', 'read', 'failed')),
  error jsonb,
  sent_by uuid references public.profiles(id) on delete set null,
  wa_timestamp timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists whatsapp_messages_conv_idx on public.whatsapp_messages(conversation_id, created_at);
create index if not exists whatsapp_messages_status_idx on public.whatsapp_messages(status);

create table if not exists public.whatsapp_webhook_events (
  id uuid primary key default gen_random_uuid(),
  received_at timestamptz not null default now(),
  signature_valid boolean not null,
  payload jsonb not null,
  processed_at timestamptz,
  error text
);
create index if not exists whatsapp_webhook_events_received_idx on public.whatsapp_webhook_events(received_at desc);

-- -----------------------------------------------------------------------------
-- Auditoría
-- -----------------------------------------------------------------------------

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_entity_idx on public.audit_logs(entity, entity_id);
create index if not exists audit_logs_created_at_idx on public.audit_logs(created_at desc);
create index if not exists audit_logs_actor_idx on public.audit_logs(actor_id);

-- -----------------------------------------------------------------------------
-- Triggers updated_at / normalización / guardas
-- -----------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'roles', 'profiles', 'staff', 'business_settings', 'payment_methods',
    'service_categories', 'services', 'service_extras', 'customers',
    'appointments', 'sales', 'commission_rules', 'commission_records',
    'inventory_items', 'nail_polishes', 'whatsapp_contacts',
    'whatsapp_conversations', 'whatsapp_messages'
  ] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t);
  end loop;
end;
$$;

drop trigger if exists customers_normalize on public.customers;
create trigger customers_normalize before insert or update on public.customers
  for each row execute function public.customers_normalize();

drop trigger if exists inventory_items_guard_quantity on public.inventory_items;
create trigger inventory_items_guard_quantity before insert or update on public.inventory_items
  for each row execute function public.inventory_items_guard_quantity();

drop trigger if exists nail_polishes_guard_status on public.nail_polishes;
create trigger nail_polishes_guard_status before update on public.nail_polishes
  for each row execute function public.nail_polishes_guard_status();

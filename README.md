# MILAN

Aplicación web **mobile-first (PWA)** para administrar MILAN, spa de uñas y pestañas:
agenda, clientas (CRM), servicios, ventas y caja, comisiones, inventario, esmaltes,
dashboard, usuarios/roles y base para WhatsApp oficial.

- Idioma: español · Zona horaria: `America/Bogota` · Moneda: COP (`$45.000`)
- Stack: **Next.js 16** (App Router, Server Actions) + **TypeScript** + **Tailwind 4** + **Supabase** (Auth, Postgres, RLS, Storage)
- Hosting: **Vercel**

---

## Puesta en marcha (producción)

### 1. Base de datos (Supabase)

Las migraciones están en `supabase/migrations/` y **no son destructivas** (solo `create … if not exists`, sin `drop` de tablas).
Aplícalas **en orden**, con una de estas opciones:

- **SQL Editor** de Supabase: pega y ejecuta cada archivo en orden (`…000100_schema.sql`, `…000200…`, `…000300…`, `…000400…`, `…000500…`).
- **CLI**: `npx supabase link --project-ref mxkiopzasbitismymvnf` y luego `npx supabase db push`.

> ⚠️ **No** ejecutes `supabase/seed.sql` en producción: son datos DEMO para desarrollo local (el propio archivo se niega a correr si detecta datos reales).

La migración `…000500_initial_data.sql` carga la configuración real: roles y permisos, horario (martes a domingo de 9:00 a 19:00), medios de pago, catálogo y precios de MILAN, **Blanca (60 %)** y **Liz (40 %)**, y los buckets de Storage `esmaltes` (público) y `referencias` (privado).

### 2. Ajustes de Auth en Supabase

- *Authentication → Sign In / Providers*: **desactiva “Allow new users to sign up”**. Los usuarios los crea administración desde la app.
- No hace falta configurar correo: el login es con **usuario y contraseña**. Internamente, cada usuario se convierte en un email técnico (`usuario@usuarios.milan.app`) al que nunca se envían correos.

### 3. Variables de entorno en Vercel

Copia `.env.example`:

| Variable | Dónde | Nota |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | pública | `https://mxkiopzasbitismymvnf.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | pública | *Project Settings → API → anon/publishable key* |
| `SUPABASE_SERVICE_ROLE_KEY` | **solo servidor** | Necesaria para crear usuarios y para el webhook. Nunca con prefijo `NEXT_PUBLIC_` |
| `AUTH_USERNAME_DOMAIN` | servidor | Opcional (por defecto `usuarios.milan.app`) |
| `WHATSAPP_*`, `META_APP_SECRET` | servidor | Vacías hasta tener la cuenta de WhatsApp Business |

### 4. Primer administrador

Con `.env.local` (URL + service-role key) en tu computador:

```bash
npm install
npm run create-admin -- blanca "UnaContraseñaSegura" "Blanca" --staff "Blanca"
```

`--staff` vincula el usuario con la profesional, para que también vea su agenda y comisiones. Los demás usuarios se crean en la app: **Más → Equipo y usuarios**.

### 5. Instalar en el celular

Abre la URL en el teléfono → menú del navegador → **“Agregar a pantalla de inicio”**.

---

## Desarrollo

```bash
npm install
cp .env.example .env.local   # completa las claves
npm run dev                  # http://localhost:3000
npm run typecheck            # tipos
npm test                     # pruebas de lógica (Vitest)
npm run test:db              # migraciones + RLS + flujos en un Postgres local temporal
npm run build
```

`npm run test:db` necesita binarios de PostgreSQL 15+. Crea una base temporal, simula lo mínimo de Supabase (`auth.uid()` y los roles `anon`, `authenticated` y `service_role`), aplica las migraciones dos veces para probar idempotencia y ejecuta `supabase/tests/*.sql`: más de 55 aserciones de negocio y seguridad.

## Arquitectura

```
src/
  app/(app)/…              pantallas (Server Components) — Inicio, Agenda, Clientes, Más…
  app/api/whatsapp/webhook  webhook oficial de Meta
  components/               UI (ui/ base + módulos)
  lib/domain/               lógica pura con tests: dinero, teléfonos, fechas Bogotá, comisión, etiquetas
  lib/data/                 acceso a datos (solo servidor, respeta RLS)
  lib/actions/              Server Actions con validación Zod
  lib/integrations/whatsapp servicio, cliente Graph API, parser, firma, herramientas del agente
  lib/supabase/             clientes navegador / servidor / admin (service-role solo servidor)
supabase/
  migrations/               esquema, funciones, RLS, datos iniciales
  seed.sql                  datos DEMO (solo local)
  tests/                    pruebas SQL
```

**Principios**

- **Sin duplicar información.** La cita alimenta a la clienta y luego a la venta. `complete_appointment` crea la venta, sus ítems y la comisión, y finaliza la cita, **en una sola transacción**. El historial y las métricas de la clienta se calculan en vistas (`customer_stats`, `customer_segments`).
- **El teléfono es la identidad de la clienta.** Se normaliza a E.164 (`+57…`) en la base y en el frontend, y es único: no se crean duplicados por diferencias en el nombre.
- **Validación en el servidor.** Las escrituras sensibles solo pasan por funciones RPC `SECURITY DEFINER` que verifican permisos: ventas, comisiones, estados de cita, inventario y esmaltes. Además, RLS está activo en **todas** las tablas.
- **Historia inmutable.** Cada comisión guarda el porcentaje aplicado. El stock solo cambia mediante movimientos (un trigger bloquea los cambios silenciosos). El estado de un esmalte solo cambia con registro en el historial. Las ventas se **anulan** con motivo; nunca se borran.
- **Auditoría** (`audit_logs`) de cambios de ventas, precios, comisiones, usuarios, configuración, ajustes y pérdidas de inventario, y esmaltes perdidos o dañados.
- **Permisos extensibles.** Están en las tablas `roles`, `permissions` y `role_permissions`. Un rol con `is_admin` tiene todos los permisos. Desde *Configuración* se puede activar o quitar a las colaboradoras el permiso de crear citas.

### Roles

| | Administración | Colaboradora |
|---|---|---|
| Agenda | Toda | Solo la suya; crea citas si está permitido |
| Clientas | Todas, con datos financieros | Solo las que atiende, sin total gastado |
| Ventas | Todas, caja, corrección y anulación | Cierra sus servicios y ve sus ventas |
| Comisiones | Todas, porcentajes y pagos | Solo las suyas |
| Inventario y esmaltes | Administración completa | Reporta salidas, pérdidas y daños, y cambios de estado de esmaltes |
| Servicios, equipo, configuración, WhatsApp, auditoría | ✓ | — |

**Equipo (compartido):** es un usuario único para las chicas que agendan y registran ventas en el spa.
- Ve la agenda de todas.
- Crea, mueve y cierra citas de cualquier profesional, eligiendo quién atendió.
- Consulta las clientas, sin montos.
- Reporta inventario y esmaltes.
- **No** ve ventas, caja, comisiones ni el dashboard. Esto está bloqueado en la base de datos (RLS), no solo oculto en la pantalla.

Para crearlo: **Más → Equipo y usuarios → + Agregar**, desmarca "Atiende clientas" y elige el rol **Equipo (compartido)**.

### Celular y escritorio

La app es **mobile-first** y se adapta al computador. En pantallas de 1024 px o más:
- La barra inferior se reemplaza por un **menú lateral**.
- El dashboard se reparte en columnas.
- La agenda semanal se muestra como **calendario de 7 columnas**.
- Clientes, ventas e inventario se muestran como **tablas**.
- Los formularios quedan centrados.

### Comisiones

Por defecto se calcula sobre el **valor del servicio cobrado, después del descuento** (el descuento se reparte en proporción entre los ítems). Se puede cambiar a “antes de descuento” en *Configuración*. Al cerrar la venta se elige **quién atendió**.

### WhatsApp (preparado, no activo)

Usa la integración oficial **WhatsApp Cloud API de Meta**: sin WhatsApp Web ni soluciones no oficiales.

- Webhook: `https://<tu-dominio>/api/whatsapp/webhook`. Atiende `GET` para la verificación con `WHATSAPP_VERIFY_TOKEN` y `POST` para recibir eventos con firma `X-Hub-Signature-256` (`META_APP_SECRET`).
- Persistencia idempotente por `wa_message_id`, estados de entrega, log crudo de eventos y errores.
- `WhatsAppService`: `receiveMessage`, `sendMessage`, `sendTemplate`, `getConversation` y `handoffToHuman`.
- `AgentTools`: `getServices`, `getServicePrice`, `getAvailableSlots`, `getCustomerByPhone`, `createAppointment`, `rescheduleAppointment` y `cancelAppointment`. Consultan siempre la base, así que nunca inventan disponibilidad.
- El agente por defecto **no responde** (`SilentAgent`). Con `HUMAN_ACTIVE` el agente nunca actúa. En *Más → Conversaciones WhatsApp* están los botones **Tomar conversación** y **Devolver al agente**.

Para activarlo: crea la app en Meta Developers, agrega el producto WhatsApp, configura las variables en Vercel y registra la URL del webhook con el verify token.

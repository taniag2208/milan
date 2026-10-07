import Link from 'next/link'
import type { Metadata } from 'next'
import { AlertTriangle, ChevronRight, Droplet } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, SectionTitle } from '@/components/ui/card'
import { Badge, stockTone } from '@/components/ui/badge'
import { ButtonLink } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { RangePicker, parseRangeKey } from '@/components/ui/range-picker'
import { Bars, MiniStat } from '@/components/dashboard/bars'
import { AppointmentCard } from '@/components/agenda/appointment-card'
import { PrimaryAction } from '@/components/agenda/status-actions'
import { can, requireSession, type AppSession } from '@/lib/auth/session'
import { getDashboard } from '@/lib/data/dashboard'
import { listAppointments, serviceNames } from '@/lib/data/appointments'
import { listSales } from '@/lib/data/sales'
import { formatQty } from '@/lib/data/inventory'
import { STOCK_STATUS } from '@/lib/domain/labels'
import { type RangeKey, addDays, formatLongDate, formatTime, localDayStartISO, resolveRange, todayLocal } from '@/lib/domain/dates'
import { formatCOP } from '@/lib/domain/money'

export const metadata: Metadata = { title: 'Inicio' }

const RANGES: RangeKey[] = ['hoy', 'semana', 'mes', 'personalizado']

export default async function HomePage({ searchParams }: PageProps<'/inicio'>) {
  const [session, sp] = await Promise.all([requireSession(), searchParams])
  const firstName = session.fullName.split(' ')[0]
  if (can(session, 'dashboard.view')) {
    return <AdminDashboard session={session} sp={sp} firstName={firstName} />
  }
  return <StaffHome session={session} firstName={firstName} />
}

async function AdminDashboard({ sp, firstName }: { session: AppSession; sp: Record<string, string | string[] | undefined>; firstName: string }) {
  const today = todayLocal()
  const rangeKey = parseRangeKey(sp.rango, RANGES)
  const { from, to } = resolveRange(rangeKey, today, { from: sp.desde as string, to: sp.hasta as string })
  const d = await getDashboard(from, to)
  const rangeLabel = rangeKey === 'hoy' ? 'de hoy' : rangeKey === 'semana' ? 'de la semana' : rangeKey === 'mes' ? 'del mes' : 'del periodo'
  const polishAlerts = d.polishes.por_acabarse + d.polishes.terminado + d.polishes.danado + d.polishes.perdido

  return (
    <>
      <PageHeader title={`Hola, ${firstName}`} subtitle={formatLongDate(today)} />
      <RangePicker basePath="/inicio" active={rangeKey} keys={RANGES} from={from} to={to} />

      <Card className="mt-4 bg-ink text-cream">
        <p className="text-xs uppercase tracking-[0.18em] text-cream/60">Ventas {rangeLabel}</p>
        <p className="mt-1 font-display text-5xl tabular">{formatCOP(d.sales_total)}</p>
        <p className="mt-1 text-sm text-cream/70">{d.sales_count} {d.sales_count === 1 ? 'venta' : 'ventas'}</p>
        <div className="mt-4 flex justify-between border-t border-cream/15 pt-3 text-sm">
          {rangeKey !== 'hoy' && <span className="text-cream/70">Hoy <span className="tabular text-cream">{formatCOP(d.today_sales_total)}</span></span>}
          <span className="text-cream/70">Mes <span className="tabular text-cream">{formatCOP(d.month_sales_total)}</span></span>
          <Link href="/ventas" className="text-cream/80 underline-offset-4 hover:underline">Ver caja</Link>
        </div>
      </Card>

      <SectionTitle>Citas {rangeLabel}</SectionTitle>
      <div className="grid grid-cols-4 gap-2">
        <MiniStat label="Total" value={d.appointments.total} />
        <MiniStat label="Pend." value={d.appointments.pendientes} />
        <MiniStat label="Atend." value={d.appointments.atendidas} tone="success" />
        <MiniStat label="Canc." value={d.appointments.canceladas} tone={d.appointments.canceladas ? 'danger' : undefined} />
      </div>

      <SectionTitle>Próxima cita</SectionTitle>
      {d.next_appointment ? (
        <Link href={`/agenda/${d.next_appointment.id}`}>
          <Card className="flex items-center gap-4 active:bg-cream/60">
            <div className="text-center">
              <p className="font-display text-2xl tabular">{formatTime(d.next_appointment.starts_at).split(' ')[0]}</p>
              <p className="text-xs text-ink-muted">{formatTime(d.next_appointment.starts_at).split(' ').slice(1).join(' ')}</p>
            </div>
            <div className="min-w-0 flex-1 border-l border-line pl-4">
              <p className="truncate font-medium">{d.next_appointment.customer}</p>
              <p className="truncate text-sm text-ink-soft">{d.next_appointment.services}</p>
              <p className="text-xs text-ink-muted">{d.next_appointment.staff}</p>
            </div>
            <ChevronRight className="size-5 text-taupe" />
          </Card>
        </Link>
      ) : (
        <Card className="text-sm text-ink-muted">No hay citas próximas.</Card>
      )}

      <SectionTitle>Clientas {rangeLabel}</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        <MiniStat label="Nuevas" value={d.customers.nuevas} />
        <MiniStat label="Recurrentes" value={d.customers.recurrentes} />
      </div>

      <SectionTitle>Servicios más vendidos</SectionTitle>
      <Card><Bars rows={d.top_services} /></Card>

      <SectionTitle>Ventas por profesional</SectionTitle>
      <Card><Bars rows={d.sales_by_staff} /></Card>

      <SectionTitle>Medios de pago</SectionTitle>
      <Card><Bars rows={d.payment_methods} /></Card>

      <SectionTitle>Comisiones pendientes</SectionTitle>
      <Link href="/comisiones">
        <Card className="flex items-center justify-between active:bg-cream/60">
          <span className="font-display text-2xl tabular">{formatCOP(d.pending_commissions)}</span>
          <ChevronRight className="size-5 text-taupe" />
        </Card>
      </Link>

      <SectionTitle>Alertas</SectionTitle>
      <Card className="space-y-4">
        <div>
          <p className="mb-2 flex items-center gap-2 text-sm font-medium"><AlertTriangle className="size-4 text-warning" /> Inventario</p>
          {d.inventory_alerts.length === 0 ? (
            <p className="text-sm text-ink-muted">Todo el inventario está disponible.</p>
          ) : (
            <ul className="divide-y divide-line">
              {d.inventory_alerts.map((i) => (
                <li key={i.id}>
                  <Link href={`/inventario/${i.id}`} className="flex items-center justify-between py-2 text-sm">
                    <span>{i.name} <span className="text-ink-muted">· {formatQty(i.quantity)} {i.unit}</span></span>
                    <Badge tone={stockTone[i.stock_status]}>{STOCK_STATUS[i.stock_status]}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="mb-2 flex items-center gap-2 text-sm font-medium"><Droplet className="size-4 text-almond" /> Esmaltes</p>
          {polishAlerts === 0 ? (
            <p className="text-sm text-ink-muted">Sin reportes de esmaltes.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {([
                ['por_acabarse', 'Por acabarse'],
                ['terminado', 'Terminados'],
                ['danado', 'Dañados'],
                ['perdido', 'Perdidos'],
              ] as const).map(([key, label]) => (
                <Link key={key} href={`/esmaltes?estado=${key}`} className="flex items-center justify-between rounded-2xl bg-cream/60 px-3 py-2.5 text-sm">
                  <span>{label}</span>
                  <span className={`font-display text-lg tabular ${key === 'perdido' && d.polishes[key] ? 'text-danger' : ''}`}>{d.polishes[key]}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </Card>
    </>
  )
}

async function StaffHome({ session, firstName }: { session: AppSession; firstName: string }) {
  const today = todayLocal()
  const shared = !session.staffId
  if (shared && !can(session, 'appointments.read_all')) {
    return (
      <>
        <PageHeader title={`Hola, ${firstName}`} subtitle={formatLongDate(today)} />
        <EmptyState title="Tu usuario no está vinculado a una profesional" description="Pide a administración que te vincule en Equipo para ver tu agenda." />
      </>
    )
  }
  const [appointments, sales] = await Promise.all([
    listAppointments({ fromISO: localDayStartISO(today), toISO: localDayStartISO(addDays(today, 1)), staffId: session.staffId }),
    shared ? Promise.resolve([]) : listSales({ fromISO: localDayStartISO(today), toISO: localDayStartISO(addDays(today, 1)), staffId: session.staffId }),
  ])
  const nowISO = new Date().toISOString()
  const current = appointments.find((a) => a.status === 'en_servicio')
  // Próxima: la siguiente pendiente/confirmada; si todas ya pasaron, la primera sin atender.
  const pending = appointments.filter((a) => ['pendiente', 'confirmada'].includes(a.status))
  const next = current ?? pending.find((a) => a.ends_at > nowISO) ?? pending[0]
  const soldToday = sales.reduce((s, x) => s + x.total, 0)

  return (
    <>
      <PageHeader title={`Hola, ${firstName}`} subtitle={formatLongDate(today)} />

      <SectionTitle>{current ? 'Atendiendo ahora' : shared ? 'Próxima cita' : 'Tu próxima cita'}</SectionTitle>
      {next ? (
        <Card className="space-y-4">
          <Link href={`/agenda/${next.id}`} className="block">
            <p className="font-display text-4xl tabular">{formatTime(next.starts_at)}</p>
            <p className="mt-1 text-lg font-medium">{next.customers?.full_name}</p>
            <p className="text-ink-soft">{serviceNames(next)}</p>
            {shared && next.staff && <p className="mt-1 text-sm text-ink-muted">Con {next.staff.display_name}</p>}
            {next.design_notes && <p className="mt-2 rounded-xl bg-cream/70 px-3 py-2 text-sm text-ink-soft">{next.design_notes}</p>}
          </Link>
          <PrimaryAction id={next.id} status={next.status} />
        </Card>
      ) : (
        <EmptyState title="No tienes más citas hoy" description="Cuando te asignen una cita aparecerá aquí." />
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <MiniStat label="Citas hoy" value={appointments.filter((a) => !['cancelada', 'no_asistio'].includes(a.status)).length} />
        {shared ? (
          <MiniStat label="Atendidas" value={appointments.filter((a) => a.status === 'finalizada').length} />
        ) : (
          <MiniStat label="Vendido hoy" value={formatCOP(soldToday)} />
        )}
      </div>

      {appointments.length > 0 && (
        <>
          <SectionTitle>{shared ? 'Agenda de hoy' : 'Tu agenda de hoy'}</SectionTitle>
          <div className="space-y-2">
            {appointments.map((a) => <AppointmentCard key={a.id} appointment={a} showStaff={shared} />)}
          </div>
        </>
      )}

      <SectionTitle>Accesos rápidos</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        <ButtonLink href="/esmaltes" variant="secondary">Reportar esmalte</ButtonLink>
        <ButtonLink href="/inventario" variant="secondary">Inventario</ButtonLink>
      </div>
    </>
  )
}

import Link from 'next/link'
import type { Metadata } from 'next'
import { CalendarPlus, ChevronLeft, ChevronRight } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Segmented } from '@/components/ui/segmented'
import { EmptyState } from '@/components/ui/empty-state'
import { ButtonLink } from '@/components/ui/button'
import { SectionTitle } from '@/components/ui/card'
import { cn } from '@/components/ui/cn'
import { AppointmentCard, AppointmentChip } from '@/components/agenda/appointment-card'
import { can, requireSession } from '@/lib/auth/session'
import { listAppointments, type AppointmentListItem } from '@/lib/data/appointments'
import { getSettings } from '@/lib/data/settings'
import { getStaff } from '@/lib/data/catalog'
import {
  addDays, formatLongDate, formatShortDate, isValidDate, isoWeekday, localDayStartISO,
  startOfWeek, toLocalDate, todayLocal, weekdayName,
} from '@/lib/domain/dates'

export const metadata: Metadata = { title: 'Agenda' }

type View = 'hoy' | 'semana' | 'lista'

export default async function AgendaPage({ searchParams }: PageProps<'/agenda'>) {
  const sp = await searchParams
  const session = await requireSession()
  const seeAll = can(session, 'appointments.read_all')
  const canCreate = can(session, 'appointments.manage_all') || can(session, 'appointments.create')
  const view: View = sp.vista === 'semana' || sp.vista === 'lista' ? sp.vista : 'hoy'
  const today = todayLocal()
  const date = isValidDate(sp.fecha as string) ? (sp.fecha as string) : today
  const staffFilter = seeAll && typeof sp.prof === 'string' ? sp.prof : null

  const [staff, settings] = await Promise.all([seeAll ? getStaff() : Promise.resolve([]), getSettings()])

  const href = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams()
    const merged = { vista: view, fecha: date === today ? null : date, prof: staffFilter, ...patch }
    for (const [k, v] of Object.entries(merged)) if (v && !(k === 'vista' && v === 'hoy')) params.set(k, v)
    const qs = params.toString()
    return qs ? `/agenda?${qs}` : '/agenda'
  }

  let range: { from: string; to: string }
  if (view === 'semana') range = { from: startOfWeek(date), to: addDays(startOfWeek(date), 7) }
  else if (view === 'lista') range = { from: today, to: addDays(today, 31) }
  else range = { from: date, to: addDays(date, 1) }

  const appointments = await listAppointments({
    fromISO: localDayStartISO(range.from),
    toISO: localDayStartISO(range.to),
    staffId: staffFilter,
    statuses: view === 'lista' ? ['pendiente', 'confirmada', 'en_servicio'] : undefined,
  })

  const step = view === 'semana' ? 7 : 1
  const closed = !settings.opening_hours?.[String(isoWeekday(date)) as keyof typeof settings.opening_hours]

  return (
    <>
      <PageHeader
        title="Agenda"
        subtitle={view === 'semana' ? `Semana del ${formatShortDate(startOfWeek(date), false)}` : view === 'lista' ? 'Próximas citas' : formatLongDate(date)}
        action={canCreate ? (
          <ButtonLink href={`/agenda/nueva${view === 'hoy' && date !== today ? `?fecha=${date}` : ''}`} size="sm" variant="soft">
            <CalendarPlus className="size-4" /> Cita
          </ButtonLink>
        ) : undefined}
      />

      <div className="lg:max-w-md">
      <Segmented
        active={view}
        items={[
          { key: 'hoy', label: 'Día', href: href({ vista: 'hoy' }) },
          { key: 'semana', label: 'Semana', href: href({ vista: 'semana' }) },
          { key: 'lista', label: 'Lista', href: href({ vista: 'lista', fecha: null }) },
        ]}
      />
      </div>

      {view !== 'lista' && (
        <div className="mt-3 flex items-center justify-between lg:max-w-md">
          <Link href={href({ fecha: addDays(date, -step) })} aria-label="Anterior" className="grid size-11 place-items-center rounded-full text-ink-soft hover:bg-cream">
            <ChevronLeft className="size-5" />
          </Link>
          <Link
            href={href({ fecha: null })}
            className={cn('rounded-full px-4 py-2 text-sm', date === today ? 'bg-beige font-medium text-ink' : 'text-ink-soft hover:bg-cream')}
          >
            Hoy
          </Link>
          <Link href={href({ fecha: addDays(date, step) })} aria-label="Siguiente" className="grid size-11 place-items-center rounded-full text-ink-soft hover:bg-cream">
            <ChevronRight className="size-5" />
          </Link>
        </div>
      )}

      {seeAll && staff.length > 1 && (
        <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {[{ id: null, display_name: 'Todas', color: '' }, ...staff].map((s) => (
            <Link
              key={s.id ?? 'all'}
              href={href({ prof: s.id })}
              className={cn(
                'flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm',
                staffFilter === s.id ? 'border-ink bg-ink text-cream' : 'border-line bg-card text-ink-soft',
              )}
            >
              {s.color && <span className="size-2 rounded-full" style={{ background: s.color }} />}
              {s.display_name}
            </Link>
          ))}
        </div>
      )}

      <div className="mt-4">
        {view === 'hoy' && (
          <DayList appointments={appointments} showStaff={seeAll && !staffFilter} closed={closed} canCreate={canCreate} date={date} />
        )}
        {view === 'semana' && <WeekList appointments={appointments} weekStart={startOfWeek(date)} showStaff={seeAll && !staffFilter} today={today} />}
        {view === 'lista' && <UpcomingList appointments={appointments} showStaff={seeAll && !staffFilter} today={today} canCreate={canCreate} />}
      </div>
    </>
  )
}

function DayList({ appointments, showStaff, closed, canCreate, date }: {
  appointments: AppointmentListItem[]; showStaff: boolean; closed: boolean; canCreate: boolean; date: string
}) {
  if (appointments.length === 0) {
    return (
      <EmptyState
        title={closed ? 'Día cerrado' : 'Sin citas'}
        description={closed ? 'MILAN no atiende este día según el horario configurado.' : 'No hay citas agendadas para este día.'}
        action={canCreate && !closed ? <ButtonLink href={`/agenda/nueva?fecha=${date}`}>+ Nueva cita</ButtonLink> : undefined}
      />
    )
  }
  const active = appointments.filter((a) => a.status !== 'cancelada' && a.status !== 'no_asistio')
  return (
    <div className="space-y-2.5">
      <p className="px-1 text-sm text-ink-muted">
        {active.length} {active.length === 1 ? 'cita' : 'citas'} · {active.filter((a) => a.status === 'finalizada').length} atendidas
      </p>
      <div className="space-y-2.5 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
        {appointments.map((a) => <AppointmentCard key={a.id} appointment={a} showStaff={showStaff} />)}
      </div>
    </div>
  )
}

function WeekList({ appointments, weekStart, showStaff, today }: {
  appointments: AppointmentListItem[]; weekStart: string; showStaff: boolean; today: string
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const byDay = (d: string) => appointments.filter((a) => toLocalDate(a.starts_at) === d)
  return (
    <>
      {/* Celular: lista por día */}
      <div className="lg:hidden">
        {days.map((d) => {
          const items = byDay(d)
          return (
            <section key={d}>
              <SectionTitle className={cn('flex items-center justify-between', d === today && 'text-ink')}>
                <Link href={`/agenda?fecha=${d}`}>{weekdayName(d)} {Number(d.slice(8))}</Link>
                <span className="normal-case tracking-normal">{items.length || ''}</span>
              </SectionTitle>
              {items.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-line px-4 py-3 text-sm text-ink-muted">Sin citas</p>
              ) : (
                <div className="space-y-2">{items.map((a) => <AppointmentCard key={a.id} appointment={a} showStaff={showStaff} />)}</div>
              )}
            </section>
          )
        })}
      </div>

      {/* Escritorio: calendario de 7 columnas */}
      <div className="hidden gap-2 lg:grid lg:grid-cols-7">
        {days.map((d) => {
          const items = byDay(d)
          return (
            <div key={d} className={cn('min-h-64 rounded-2xl p-2', d === today ? 'bg-beige/50' : 'bg-cream/40')}>
              <Link href={`/agenda?fecha=${d}`} className="mb-2 flex items-baseline justify-between px-1">
                <span className="text-xs uppercase tracking-wider text-ink-muted">{weekdayName(d, true)}</span>
                <span className={cn('font-display text-xl', d === today ? 'text-ink' : 'text-ink-soft')}>{Number(d.slice(8))}</span>
              </Link>
              <div className="space-y-1.5">
                {items.length === 0 ? (
                  <p className="px-1 text-xs text-ink-muted">—</p>
                ) : (
                  items.map((a) => <AppointmentChip key={a.id} appointment={a} />)
                )}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

function UpcomingList({ appointments, showStaff, today, canCreate }: {
  appointments: AppointmentListItem[]; showStaff: boolean; today: string; canCreate: boolean
}) {
  if (appointments.length === 0) {
    return (
      <EmptyState
        title="No hay citas próximas"
        description="Las citas pendientes y confirmadas de los próximos 30 días aparecen aquí."
        action={canCreate ? <ButtonLink href="/agenda/nueva">+ Nueva cita</ButtonLink> : undefined}
      />
    )
  }
  const groups = new Map<string, AppointmentListItem[]>()
  for (const a of appointments) {
    const d = toLocalDate(a.starts_at)
    groups.set(d, [...(groups.get(d) ?? []), a])
  }
  return (
    <div>
      {[...groups.entries()].map(([d, items]) => (
        <section key={d}>
          <SectionTitle>{d === today ? 'Hoy' : d === addDays(today, 1) ? 'Mañana' : formatLongDate(d)}</SectionTitle>
          <div className="space-y-2 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">{items.map((a) => <AppointmentCard key={a.id} appointment={a} showStaff={showStaff} />)}</div>
        </section>
      ))}
    </div>
  )
}

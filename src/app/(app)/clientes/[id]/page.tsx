import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { CalendarPlus, MessageCircle, Pencil, Phone } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, SectionTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ButtonLink } from '@/components/ui/button'
import { Flash } from '@/components/ui/flash'
import { AppointmentCard } from '@/components/agenda/appointment-card'
import { MiniStat } from '@/components/dashboard/bars'
import { can, canViewMoney, requireSession } from '@/lib/auth/session'
import { getCustomerDetail, getCustomerVisits } from '@/lib/data/customers'
import { serviceNames } from '@/lib/data/appointments'
import { CHANNELS, SEGMENTS } from '@/lib/domain/labels'
import { formatCOP } from '@/lib/domain/money'
import { formatPhone, whatsappLink } from '@/lib/domain/phone'
import { formatShortDate, toLocalDate } from '@/lib/domain/dates'

export const metadata: Metadata = { title: 'Clienta' }

export default async function CustomerPage({ params, searchParams }: PageProps<'/clientes/[id]'>) {
  const [{ id }, sp, session] = await Promise.all([params, searchParams, requireSession()])
  const detail = await getCustomerDetail(id, new Date().toISOString())
  if (!detail) notFound()
  const { customer: c, stats, segments, upcoming, history } = detail
  const seeFinancials = canViewMoney(session)
  // Sin acceso a montos: el historial se arma con las citas finalizadas.
  const visits = seeFinancials ? [] : await getCustomerVisits(c.id)
  const visitCount = seeFinancials ? stats?.visits ?? 0 : visits.length
  const lastVisit = seeFinancials ? stats?.last_visit_at : visits[0]?.finished_at ?? visits[0]?.starts_at
  const canSchedule = can(session, 'appointments.manage_all') || can(session, 'appointments.create')

  return (
    <div className="lg:mx-auto lg:max-w-3xl">
      <PageHeader
        title={c.full_name}
        subtitle={formatPhone(c.phone_e164)}
        backHref="/clientes"
        action={can(session, 'customers.manage') ? (
          <ButtonLink href={`/clientes/${c.id}/editar`} variant="ghost" size="sm" aria-label="Editar clienta">
            <Pencil className="size-4" />
          </ButtonLink>
        ) : undefined}
      />
      <Flash ok={sp.ok} />

      {segments.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {segments.map((s) => <Badge key={s} tone={s === 'vip' ? 'dark' : s === 'por_reactivar' || s === 'inactiva' ? 'warning' : 'info'}>{SEGMENTS[s]}</Badge>)}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <MiniStat label="Visitas" value={visitCount} />
        <MiniStat label="Última" value={lastVisit ? formatShortDate(toLocalDate(lastVisit), false) : '—'} />
        {seeFinancials ? <MiniStat label="Gastado" value={formatCOP(stats?.total_spent ?? 0)} /> : <MiniStat label="Origen" value={CHANNELS[c.source]} />}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {canSchedule && (
          <ButtonLink href={`/agenda/nueva?cliente=${c.id}`} className="col-span-3">
            <CalendarPlus className="size-4" /> Agendar cita
          </ButtonLink>
        )}
        {c.phone_e164 && (
          <>
            <ButtonLink href={whatsappLink(c.phone_e164, `Hola ${c.full_name.split(' ')[0]}, te escribimos de MILAN ✨`)} target="_blank" variant="secondary" className="col-span-2">
              <MessageCircle className="size-4" /> WhatsApp
            </ButtonLink>
            <ButtonLink href={`tel:${c.phone_e164}`} variant="secondary" aria-label="Llamar">
              <Phone className="size-4" />
            </ButtonLink>
          </>
        )}
      </div>

      {(c.notes || stats?.favorite_service || stats?.usual_staff || c.birth_date || c.instagram) && (
        <Card className="mt-4 space-y-2 text-sm">
          {stats?.favorite_service && <Row label="Servicio favorito" value={stats.favorite_service} />}
          {stats?.usual_staff && <Row label="Profesional habitual" value={stats.usual_staff} />}
          {c.birth_date && <Row label="Cumpleaños" value={formatShortDate(c.birth_date, false)} />}
          {c.instagram && <Row label="Instagram" value={`@${c.instagram}`} />}
          {stats?.first_visit_at && <Row label="Primera visita" value={formatShortDate(toLocalDate(stats.first_visit_at))} />}
          {c.notes && <p className="whitespace-pre-line border-t border-line pt-2 text-ink-soft">{c.notes}</p>}
        </Card>
      )}

      <SectionTitle>Próxima cita</SectionTitle>
      {upcoming.length ? (
        <div className="space-y-2">{upcoming.map((a) => <AppointmentCard key={a.id} appointment={a} />)}</div>
      ) : (
        <Card className="text-sm text-ink-muted">Sin citas próximas.</Card>
      )}

      <SectionTitle>Historial</SectionTitle>
      {!seeFinancials ? (
        visits.length === 0 ? (
          <Card className="text-sm text-ink-muted">Aún no hay servicios registrados.</Card>
        ) : (
          <ol className="space-y-2">
            {visits.map((v) => (
              <li key={v.id}>
                <Card>
                  <p className="text-sm text-ink-muted">{formatShortDate(toLocalDate(v.starts_at))}</p>
                  <p className="mt-1">{serviceNames(v)}</p>
                  <p className="mt-1 text-xs text-ink-muted">{v.staff?.display_name}</p>
                  {(v.design_notes || v.notes) && (
                    <p className="mt-2 rounded-xl bg-cream/60 px-3 py-2 text-sm text-ink-soft">{v.design_notes ?? v.notes}</p>
                  )}
                </Card>
              </li>
            ))}
          </ol>
        )
      ) : history.length === 0 ? (
        <Card className="text-sm text-ink-muted">Aún no hay servicios registrados.</Card>
      ) : (
        <ol className="space-y-2">
          {history.map((h) => (
            <li key={h.id}>
              <Link href={`/ventas/${h.id}`}>
                <Card className="active:bg-cream/60">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm text-ink-muted">{formatShortDate(toLocalDate(h.sold_at))}</p>
                    <p className="font-medium tabular">{formatCOP(h.total)}</p>
                  </div>
                  <p className="mt-1">{h.sale_items.filter((i) => i.kind === 'servicio').map((i) => i.description).join(' + ')}</p>
                  {h.sale_items.some((i) => i.kind === 'extra') && (
                    <p className="text-sm text-ink-soft">+ {h.sale_items.filter((i) => i.kind === 'extra').map((i) => i.description).join(', ')}</p>
                  )}
                  <p className="mt-1 text-xs text-ink-muted">{h.staff?.display_name}</p>
                  {(h.appointments?.design_notes || h.notes) && (
                    <p className="mt-2 rounded-xl bg-cream/60 px-3 py-2 text-sm text-ink-soft">{h.appointments?.design_notes ?? h.notes}</p>
                  )}
                </Card>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-ink-muted">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  )
}

import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { MessageCircle, Pencil, Phone, Receipt } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, SectionTitle } from '@/components/ui/card'
import { Badge, appointmentTone } from '@/components/ui/badge'
import { ButtonLink } from '@/components/ui/button'
import { Flash } from '@/components/ui/flash'
import { PrimaryAction, SecondaryActions } from '@/components/agenda/status-actions'
import { can, requireSession } from '@/lib/auth/session'
import { appointmentTotal, getAppointment, signedReferenceUrl } from '@/lib/data/appointments'
import { APPOINTMENT_STATUS, CHANNELS } from '@/lib/domain/labels'
import { formatDuration, formatLongDate, formatTime, toLocalDate } from '@/lib/domain/dates'
import { formatCOP } from '@/lib/domain/money'
import { formatPhone, whatsappLink } from '@/lib/domain/phone'

export const metadata: Metadata = { title: 'Cita' }

export default async function AppointmentPage({ params, searchParams }: PageProps<'/agenda/[id]'>) {
  const [{ id }, sp, session] = await Promise.all([params, searchParams, requireSession()])
  const a = await getAppointment(id)
  if (!a) notFound()

  const isManager = can(session, 'appointments.manage_all')
  const isOwn = a.staff_id === session.staffId
  const canOperate = isManager || isOwn
  const canEdit = (isManager || (isOwn && can(session, 'appointments.create'))) && ['pendiente', 'confirmada'].includes(a.status)
  const canCancel = isManager || (isOwn && can(session, 'appointments.create'))
  const sale = a.sales?.find((s) => s.status === 'registrada')
  const referenceUrl = await signedReferenceUrl(a.reference_image_path)
  const duration = a.appointment_services.reduce((s, x) => s + x.duration_min, 0)
  const phone = a.customers?.phone_e164

  return (
    <>
      <PageHeader title={a.customers?.full_name ?? 'Cita'} subtitle={formatLongDate(toLocalDate(a.starts_at))} backHref="/agenda" />
      <Flash ok={sp.ok} />

      <Card className="space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-display text-3xl tabular">{formatTime(a.starts_at)}</p>
            <p className="text-sm text-ink-muted">hasta {formatTime(a.ends_at)} · {formatDuration(duration)}</p>
          </div>
          <Badge tone={appointmentTone[a.status]}>{APPOINTMENT_STATUS[a.status]}</Badge>
        </div>

        <div className="divide-y divide-line border-y border-line">
          {a.appointment_services.map((s, i) => (
            <div key={i} className="flex justify-between py-2.5 text-[15px]">
              <span>{s.services?.name}</span>
              <span className="tabular text-ink-soft">{formatCOP(s.price)}</span>
            </div>
          ))}
          {a.appointment_services.length > 1 && (
            <div className="flex justify-between py-2.5 text-[15px] font-medium">
              <span>Total estimado</span>
              <span className="tabular">{formatCOP(appointmentTotal(a))}</span>
            </div>
          )}
        </div>

        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-ink-muted">Profesional</dt>
            <dd className="mt-0.5 flex items-center gap-1.5 font-medium">
              <span className="size-2 rounded-full" style={{ background: a.staff?.color }} />
              {a.staff?.display_name}
            </dd>
          </div>
          <div>
            <dt className="text-ink-muted">Origen</dt>
            <dd className="mt-0.5 font-medium">{CHANNELS[a.channel]}</dd>
          </div>
        </dl>

        {canOperate && (
          <div className="space-y-2 pt-1">
            {sale ? (
              <ButtonLink href={`/ventas/${sale.id}`} variant="soft" block>
                <Receipt className="size-4" /> Venta registrada · {formatCOP(sale.total)}
              </ButtonLink>
            ) : (
              <PrimaryAction id={a.id} status={a.status} />
            )}
            <SecondaryActions id={a.id} status={a.status} canCancel={canCancel} canReactivate={isManager} />
          </div>
        )}
      </Card>

      {(a.design_notes || a.notes || referenceUrl || a.cancel_reason) && (
        <>
          <SectionTitle>Detalles</SectionTitle>
          <Card className="space-y-3 text-[15px]">
            {a.design_notes && (
              <div>
                <p className="text-sm text-ink-muted">Diseño solicitado</p>
                <p className="whitespace-pre-line">{a.design_notes}</p>
              </div>
            )}
            {a.notes && (
              <div>
                <p className="text-sm text-ink-muted">Notas</p>
                <p className="whitespace-pre-line">{a.notes}</p>
              </div>
            )}
            {a.cancel_reason && (
              <div>
                <p className="text-sm text-ink-muted">Motivo de cancelación</p>
                <p>{a.cancel_reason}</p>
              </div>
            )}
            {referenceUrl && (
              <a href={referenceUrl} target="_blank" rel="noreferrer" className="block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={referenceUrl} alt="Referencia del diseño" className="max-h-80 w-full rounded-2xl object-cover" />
              </a>
            )}
          </Card>
        </>
      )}

      <SectionTitle>Clienta</SectionTitle>
      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">{a.customers?.full_name}</p>
            {phone && <p className="text-sm text-ink-muted tabular">{formatPhone(phone)}</p>}
          </div>
          {a.customers && (
            <Link href={`/clientes/${a.customers.id}`} className="text-sm text-almond-deep underline-offset-4 hover:underline">
              Ver ficha
            </Link>
          )}
        </div>
        {phone && (
          <div className="grid grid-cols-2 gap-2">
            <ButtonLink href={whatsappLink(phone)} target="_blank" variant="secondary">
              <MessageCircle className="size-4" /> WhatsApp
            </ButtonLink>
            <ButtonLink href={`tel:${phone}`} variant="secondary">
              <Phone className="size-4" /> Llamar
            </ButtonLink>
          </div>
        )}
      </Card>

      {canEdit && (
        <ButtonLink href={`/agenda/${a.id}/editar`} variant="ghost" block className="mt-4">
          <Pencil className="size-4" /> Editar o reprogramar
        </ButtonLink>
      )}
    </>
  )
}

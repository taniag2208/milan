import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui/page-header'
import { AppointmentForm } from '@/components/agenda/appointment-form'
import { can, requireSession } from '@/lib/auth/session'
import { getAppointment } from '@/lib/data/appointments'
import { getCatalog, getStaff } from '@/lib/data/catalog'
import { toLocalDate, toLocalTime } from '@/lib/domain/dates'

export const metadata: Metadata = { title: 'Editar cita' }

export default async function EditAppointmentPage({ params }: PageProps<'/agenda/[id]/editar'>) {
  const [{ id }, session] = await Promise.all([params, requireSession()])
  const a = await getAppointment(id)
  if (!a) notFound()
  const allowed = can(session, 'appointments.manage_all') || (a.staff_id === session.staffId && can(session, 'appointments.create'))
  if (!allowed || !['pendiente', 'confirmada'].includes(a.status)) redirect(`/agenda/${id}`)
  const [{ categories }, staff] = await Promise.all([getCatalog(), getStaff()])

  return (
    <>
      <PageHeader title="Editar cita" subtitle={a.customers?.full_name} backHref={`/agenda/${id}`} />
      <AppointmentForm
        mode="edit"
        categories={categories}
        staff={staff}
        canOverrideHours={can(session, 'appointments.manage_all')}
        defaults={{
          appointmentId: a.id,
          customer: a.customers ? { id: a.customers.id, full_name: a.customers.full_name } : null,
          staffId: a.staff_id,
          date: toLocalDate(a.starts_at),
          time: toLocalTime(a.starts_at),
          serviceIds: a.appointment_services.map((s) => s.services?.id).filter(Boolean) as string[],
          channel: a.channel,
          notes: a.notes,
          designNotes: a.design_notes,
        }}
      />
    </>
  )
}

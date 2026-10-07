import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui/page-header'
import { CloseSaleForm } from '@/components/agenda/close-sale-form'
import { can, requireSession } from '@/lib/auth/session'
import { getAppointment } from '@/lib/data/appointments'
import { getCatalog, getPaymentMethods, getStaff } from '@/lib/data/catalog'

export const metadata: Metadata = { title: 'Finalizar servicio' }

export default async function CloseAppointmentPage({ params }: PageProps<'/agenda/[id]/cerrar'>) {
  const [{ id }, session] = await Promise.all([params, requireSession()])
  const a = await getAppointment(id)
  if (!a) notFound()
  const allowed = can(session, 'appointments.manage_all') || (a.staff_id === session.staffId && can(session, 'sales.create'))
  if (!allowed || !['pendiente', 'confirmada', 'en_servicio'].includes(a.status)) redirect(`/agenda/${id}`)

  const [catalog, staff, paymentMethods] = await Promise.all([getCatalog(), getStaff(), getPaymentMethods()])
  const initialServices = a.appointment_services
    .map((as) => ({ service: catalog.services.find((s) => s.id === as.services?.id), price: as.price }))
    .filter((x): x is { service: NonNullable<typeof x.service>; price: number } => Boolean(x.service))

  return (
    <div className="lg:mx-auto lg:max-w-2xl">
      <PageHeader title="Finalizar servicio" subtitle={a.customers?.full_name} backHref={`/agenda/${id}`} />
      <CloseSaleForm
        appointmentId={a.id}
        customerName={a.customers?.full_name ?? ''}
        initialServices={initialServices}
        services={catalog.services}
        extras={catalog.extras}
        staff={staff}
        defaultStaffId={a.staff_id}
        paymentMethods={paymentMethods}
      />
    </div>
  )
}

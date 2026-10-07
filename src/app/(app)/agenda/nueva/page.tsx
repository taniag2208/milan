import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui/page-header'
import { AppointmentForm } from '@/components/agenda/appointment-form'
import { can, requirePermission } from '@/lib/auth/session'
import { getCatalog, getStaff } from '@/lib/data/catalog'
import { createClient } from '@/lib/supabase/server'
import { isValidDate, todayLocal } from '@/lib/domain/dates'

export const metadata: Metadata = { title: 'Nueva cita' }

export default async function NewAppointmentPage({ searchParams }: PageProps<'/agenda/nueva'>) {
  const session = await requirePermission('appointments.manage_all', 'appointments.create')
  const sp = await searchParams
  const [{ categories }, staff] = await Promise.all([getCatalog(), getStaff()])

  let customer: { id: string; full_name: string } | null = null
  if (typeof sp.cliente === 'string') {
    const supabase = await createClient()
    const { data } = await supabase.from('customers').select('id, full_name').eq('id', sp.cliente).maybeSingle()
    customer = data
  }

  return (
    <>
      <PageHeader title="Nueva cita" backHref={customer ? `/clientes/${customer.id}` : '/agenda'} />
      <AppointmentForm
        mode="create"
        categories={categories}
        staff={staff}
        canOverrideHours={can(session, 'appointments.manage_all')}
        defaults={{
          customer,
          staffId: session.staffId ?? staff[0]?.id,
          date: isValidDate(sp.fecha as string) ? (sp.fecha as string) : todayLocal(),
          time: typeof sp.hora === 'string' ? sp.hora : undefined,
        }}
      />
    </>
  )
}

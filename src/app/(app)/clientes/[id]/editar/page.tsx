import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui/page-header'
import { CustomerForm } from '@/components/clientes/customer-form'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import type { Customer } from '@/lib/types/db'

export const metadata: Metadata = { title: 'Editar clienta' }

export default async function EditCustomerPage({ params }: PageProps<'/clientes/[id]/editar'>) {
  await requirePermission('customers.manage')
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('customers').select('*').eq('id', id).maybeSingle<Customer>()
  if (!data) notFound()
  return (
    <div className="lg:mx-auto lg:max-w-2xl">
      <PageHeader title="Editar clienta" backHref={`/clientes/${id}`} />
      <CustomerForm customer={data} />
    </div>
  )
}

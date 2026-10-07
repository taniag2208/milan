import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui/page-header'
import { CustomerForm } from '@/components/clientes/customer-form'
import { requirePermission } from '@/lib/auth/session'

export const metadata: Metadata = { title: 'Nueva clienta' }

export default async function NewCustomerPage() {
  await requirePermission('customers.manage')
  return (
    <div className="lg:mx-auto lg:max-w-2xl">
      <PageHeader title="Nueva clienta" backHref="/clientes" />
      <CustomerForm />
    </div>
  )
}

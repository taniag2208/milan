import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui/page-header'
import { ServiceForm } from '@/components/servicios/service-form'
import { requirePermission } from '@/lib/auth/session'
import { getCatalog } from '@/lib/data/catalog'

export const metadata: Metadata = { title: 'Nuevo servicio' }

export default async function NewServicePage() {
  await requirePermission('services.manage')
  const { categories } = await getCatalog({ includeInactive: true })
  return (
    <>
      <PageHeader title="Nuevo servicio" backHref="/servicios" />
      <ServiceForm categories={categories} />
    </>
  )
}

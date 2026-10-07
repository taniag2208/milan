import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui/page-header'
import { ServiceForm } from '@/components/servicios/service-form'
import { requirePermission } from '@/lib/auth/session'
import { getCatalog } from '@/lib/data/catalog'

export const metadata: Metadata = { title: 'Editar servicio' }

export default async function EditServicePage({ params }: PageProps<'/servicios/[id]'>) {
  await requirePermission('services.manage')
  const { id } = await params
  const { categories, services } = await getCatalog({ includeInactive: true })
  const service = services.find((s) => s.id === id)
  if (!service) notFound()
  return (
    <div className="lg:mx-auto lg:max-w-2xl">
      <PageHeader title={service.name} subtitle="Editar servicio" backHref="/servicios" />
      <ServiceForm service={service} categories={categories} />
    </div>
  )
}

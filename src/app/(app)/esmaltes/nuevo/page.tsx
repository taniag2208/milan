import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui/page-header'
import { Flash } from '@/components/ui/flash'
import { PolishForm } from '@/components/esmaltes/polish-form'
import { requirePermission } from '@/lib/auth/session'
import { todayLocal } from '@/lib/domain/dates'

export const metadata: Metadata = { title: 'Nuevo esmalte' }

export default async function NewPolishPage({ searchParams }: PageProps<'/esmaltes/nuevo'>) {
  await requirePermission('polishes.manage')
  const sp = await searchParams
  return (
    <>
      <PageHeader title="Nuevo esmalte" backHref="/esmaltes" />
      <Flash ok={sp.ok} />
      <PolishForm today={todayLocal()} />
    </>
  )
}

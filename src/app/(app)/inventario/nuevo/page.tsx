import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui/page-header'
import { ItemForm } from '@/components/inventario/item-form'
import { requirePermission } from '@/lib/auth/session'
import { listInventory } from '@/lib/data/inventory'

export const metadata: Metadata = { title: 'Nuevo producto' }

export default async function NewItemPage() {
  await requirePermission('inventory.manage')
  const items = await listInventory({})
  const categories = [...new Set(items.map((i) => i.category))]
  return (
    <div className="lg:mx-auto lg:max-w-2xl">
      <PageHeader title="Nuevo producto" backHref="/inventario" />
      <ItemForm categories={categories} />
    </div>
  )
}

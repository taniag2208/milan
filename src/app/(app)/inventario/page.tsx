import Link from 'next/link'
import type { Metadata } from 'next'
import { Droplet, Package, Search } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Badge, stockTone } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { ButtonLink } from '@/components/ui/button'
import { Segmented } from '@/components/ui/segmented'
import { can, requireSession } from '@/lib/auth/session'
import { formatQty, listInventory } from '@/lib/data/inventory'
import { STOCK_STATUS, type StockStatus } from '@/lib/domain/labels'

export const metadata: Metadata = { title: 'Inventario' }

export default async function InventoryPage({ searchParams }: PageProps<'/inventario'>) {
  const [session, sp] = await Promise.all([requireSession(), searchParams])
  const status = (['stock_bajo', 'agotado'] as StockStatus[]).includes(sp.estado as StockStatus) ? (sp.estado as StockStatus) : null
  const q = typeof sp.q === 'string' ? sp.q : ''
  const items = await listInventory({ q, status })
  const qs = (s: string | null) => `/inventario${s ? `?estado=${s}` : ''}`

  return (
    <>
      <PageHeader
        title="Inventario"
        backHref="/mas"
        action={<ButtonLink href="/esmaltes" size="sm" variant="soft"><Droplet className="size-4" /> Esmaltes</ButtonLink>}
      />
      <form method="get" className="relative mb-3">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
        <input type="search" name="q" defaultValue={q} placeholder="Buscar producto" className="h-12 w-full rounded-full border border-line bg-card pl-10 pr-4 focus:border-almond focus:outline-none" />
      </form>
      <Segmented
        active={status ?? 'todos'}
        items={[
          { key: 'todos', label: 'Todos', href: qs(null) },
          { key: 'stock_bajo', label: 'Stock bajo', href: qs('stock_bajo') },
          { key: 'agotado', label: 'Agotados', href: qs('agotado') },
        ]}
      />
      <div className="mt-4">
        {items.length === 0 ? (
          <EmptyState
            icon={<Package className="size-8" strokeWidth={1.3} />}
            title={status || q ? 'Sin resultados' : 'Inventario vacío'}
            description={status ? '¡Bien! No hay productos en este estado.' : 'Registra los productos que usa el spa.'}
            action={can(session, 'inventory.manage') && !status ? <ButtonLink href="/inventario/nuevo">+ Nuevo producto</ButtonLink> : undefined}
          />
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-card">
            {items.map((i) => (
              <li key={i.id}>
                <Link href={`/inventario/${i.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-cream/60">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{i.name}</span>
                    <span className="block text-sm text-ink-muted">{i.category}</span>
                  </span>
                  <span className="text-right">
                    <span className="block font-display text-xl tabular">{formatQty(i.quantity)} <span className="font-sans text-xs text-ink-muted">{i.unit}</span></span>
                    {i.stock_status !== 'disponible' && <Badge tone={stockTone[i.stock_status]}>{STOCK_STATUS[i.stock_status]}</Badge>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

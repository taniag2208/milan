import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui/page-header'
import { Card, SectionTitle } from '@/components/ui/card'
import { Badge, stockTone } from '@/components/ui/badge'
import { Flash } from '@/components/ui/flash'
import { MovementForm } from '@/components/inventario/movement-form'
import { ItemForm } from '@/components/inventario/item-form'
import { can, requireSession } from '@/lib/auth/session'
import { formatQty, getInventoryItem, listInventory } from '@/lib/data/inventory'
import { MOVEMENT_TYPES, STOCK_STATUS, type MovementType } from '@/lib/domain/labels'
import { formatShortDate, formatTime, toLocalDate } from '@/lib/domain/dates'
import { formatCOP } from '@/lib/domain/money'

export const metadata: Metadata = { title: 'Producto' }

export default async function ItemPage({ params, searchParams }: PageProps<'/inventario/[id]'>) {
  const [{ id }, sp, session] = await Promise.all([params, searchParams, requireSession()])
  const data = await getInventoryItem(id)
  if (!data) notFound()
  const { item, movements } = data
  const manage = can(session, 'inventory.manage')
  const allowed: MovementType[] = manage
    ? ['entrada', 'salida', 'ajuste', 'perdida', 'dano']
    : can(session, 'inventory.report') ? ['salida', 'perdida', 'dano'] : []
  const categories = manage ? [...new Set((await listInventory({})).map((i) => i.category))] : []

  return (
    <div className="lg:mx-auto lg:max-w-2xl">
      <PageHeader title={item.name} subtitle={item.category} backHref="/inventario" />
      <Flash ok={sp.ok} />
      <Card className="flex items-center justify-between">
        <div>
          <p className="font-display text-5xl tabular">{formatQty(item.quantity)}</p>
          <p className="text-sm text-ink-muted">{item.unit} · mínimo {formatQty(item.min_stock)}</p>
        </div>
        <div className="text-right">
          <Badge tone={stockTone[item.stock_status]}>{STOCK_STATUS[item.stock_status]}</Badge>
          {item.unit_cost != null && manage && <p className="mt-2 text-xs text-ink-muted">Costo {formatCOP(item.unit_cost)}</p>}
          {item.supplier && <p className="text-xs text-ink-muted">{item.supplier}</p>}
        </div>
      </Card>

      {allowed.length > 0 && (
        <>
          <SectionTitle>Registrar movimiento</SectionTitle>
          <Card><MovementForm itemId={item.id} unit={item.unit} allowed={allowed} /></Card>
        </>
      )}

      <SectionTitle>Movimientos</SectionTitle>
      {movements.length === 0 ? (
        <Card className="text-sm text-ink-muted">Sin movimientos.</Card>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-card">
          {movements.map((m) => (
            <li key={m.id} className="px-4 py-3 text-sm">
              <div className="flex justify-between">
                <span className="font-medium">{MOVEMENT_TYPES[m.movement_type]}</span>
                <span className={`tabular font-medium ${m.delta < 0 ? 'text-danger' : 'text-success'}`}>
                  {m.delta > 0 ? '+' : ''}{formatQty(m.delta)} → {formatQty(m.quantity_after)}
                </span>
              </div>
              <p className="text-ink-muted">
                {formatShortDate(toLocalDate(m.created_at), false)} {formatTime(m.created_at)}
                {m.profiles?.full_name && ` · ${m.profiles.full_name}`}
              </p>
              {(m.reason || m.note) && <p className="text-ink-soft">{[m.reason, m.note].filter(Boolean).join(' — ')}</p>}
            </li>
          ))}
        </ul>
      )}

      {manage && (
        <>
          <SectionTitle>Editar producto</SectionTitle>
          <Card><ItemForm item={item} categories={categories} /></Card>
        </>
      )}
    </div>
  )
}

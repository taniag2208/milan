import Link from 'next/link'
import type { Metadata } from 'next'
import { Receipt } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, SectionTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Badge } from '@/components/ui/badge'
import { RangePicker, parseRangeKey } from '@/components/ui/range-picker'
import { Bars } from '@/components/dashboard/bars'
import { redirect } from 'next/navigation'
import { can, canViewSales, requireSession } from '@/lib/auth/session'
import { listSales, summarizeByPayment } from '@/lib/data/sales'
import { type RangeKey, addDays, formatShortDate, formatTime, localDayStartISO, resolveRange, toLocalDate, todayLocal } from '@/lib/domain/dates'
import { formatCOP } from '@/lib/domain/money'

export const metadata: Metadata = { title: 'Ventas' }
const RANGES: RangeKey[] = ['hoy', 'semana', 'mes', 'personalizado']

export default async function SalesPage({ searchParams }: PageProps<'/ventas'>) {
  const session = await requireSession()
  if (!canViewSales(session)) redirect('/inicio')
  const sp = await searchParams
  const seeAll = can(session, 'sales.read_all')
  const rangeKey = parseRangeKey(sp.rango, RANGES)
  const { from, to } = resolveRange(rangeKey, todayLocal(), { from: sp.desde as string, to: sp.hasta as string })
  const sales = await listSales({
    fromISO: localDayStartISO(from),
    toISO: localDayStartISO(addDays(to, 1)),
    staffId: seeAll ? null : session.staffId,
    includeVoided: seeAll,
  })
  const valid = sales.filter((s) => s.status === 'registrada')
  const total = valid.reduce((s, x) => s + x.total, 0)
  const byPayment = summarizeByPayment(sales)

  return (
    <>
      <PageHeader title={seeAll ? 'Ventas y caja' : 'Mis ventas'} backHref="/mas" />
      <RangePicker basePath="/ventas" active={rangeKey} keys={RANGES} from={from} to={to} />

      <Card className="mt-4">
        <p className="text-xs uppercase tracking-[0.16em] text-ink-muted">Total vendido</p>
        <p className="font-display text-4xl tabular">{formatCOP(total)}</p>
        <p className="text-sm text-ink-muted">{valid.length} {valid.length === 1 ? 'venta' : 'ventas'}</p>
      </Card>

      {seeAll && (
        <>
          <SectionTitle>Caja por medio de pago</SectionTitle>
          <Card><Bars rows={byPayment} /></Card>
        </>
      )}

      <SectionTitle>Detalle</SectionTitle>
      {sales.length === 0 ? (
        <EmptyState icon={<Receipt className="size-8" strokeWidth={1.3} />} title="Sin ventas" description="Las ventas se crean al finalizar un servicio." />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-card">
          {sales.map((s) => (
            <li key={s.id}>
              <Link href={`/ventas/${s.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-cream/60">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{s.customers?.full_name ?? 'Venta'}</span>
                  <span className="block truncate text-sm text-ink-muted">
                    {from !== to && `${formatShortDate(toLocalDate(s.sold_at), false)} · `}{formatTime(s.sold_at)} · {s.staff?.display_name} · {s.payment_methods?.name}
                  </span>
                </span>
                {s.status === 'anulada' ? (
                  <Badge tone="danger">Anulada</Badge>
                ) : (
                  <span className="font-medium tabular">{formatCOP(s.total)}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

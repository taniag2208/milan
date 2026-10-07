import Link from 'next/link'
import type { Metadata } from 'next'
import { Receipt } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, SectionTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Badge } from '@/components/ui/badge'
import { RangePicker, parseRangeKey } from '@/components/ui/range-picker'
import { Bars } from '@/components/dashboard/bars'
import { DataTable, RowLink } from '@/components/ui/table'
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
      <div className="lg:max-w-md"><RangePicker basePath="/ventas" active={rangeKey} keys={RANGES} from={from} to={to} /></div>

      <div className="lg:mt-4 lg:grid lg:grid-cols-3 lg:items-start lg:gap-6">
      <Card className="mt-4 lg:mt-0">
        <p className="text-xs uppercase tracking-[0.16em] text-ink-muted">Total vendido</p>
        <p className="font-display text-4xl tabular">{formatCOP(total)}</p>
        <p className="text-sm text-ink-muted">{valid.length} {valid.length === 1 ? 'venta' : 'ventas'}</p>
      </Card>

      {seeAll && (
        <section className="mt-6 lg:col-span-2 lg:mt-0">
          <SectionTitle className="lg:mt-0">Caja por medio de pago</SectionTitle>
          <Card><Bars rows={byPayment} /></Card>
        </section>
      )}
      </div>

      <SectionTitle>Detalle</SectionTitle>
      {sales.length === 0 ? (
        <EmptyState icon={<Receipt className="size-8" strokeWidth={1.3} />} title="Sin ventas" description="Las ventas se crean al finalizar un servicio." />
      ) : (
        <>
        <DataTable head={['Fecha', 'Clienta', 'Servicios', 'Atendió', 'Pago', 'Total']}>
          {sales.map((s) => (
            <RowLink
              key={s.id}
              href={`/ventas/${s.id}`}
              cells={[
                <span key="f" className="whitespace-nowrap text-ink-soft">{formatShortDate(toLocalDate(s.sold_at), false)} · {formatTime(s.sold_at)}</span>,
                <span key="c" className="font-medium">{s.customers?.full_name ?? '—'}</span>,
                <span key="s" className="text-ink-soft">{s.sale_items.filter((i) => i.kind === 'servicio').map((i) => i.description).join(' + ')}</span>,
                <span key="a">{s.staff?.display_name}</span>,
                <span key="p" className="text-ink-soft">{s.payment_methods?.name}</span>,
                s.status === 'anulada'
                  ? <Badge key="t" tone="danger">Anulada</Badge>
                  : <span key="t" className="tabular font-medium">{formatCOP(s.total)}</span>,
              ]}
            />
          ))}
        </DataTable>
        <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-card lg:hidden">
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
        </>
      )}
    </>
  )
}

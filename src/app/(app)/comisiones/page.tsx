import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { RangePicker, parseRangeKey } from '@/components/ui/range-picker'
import { MarkPaidButton } from '@/components/ventas/mark-paid-button'
import { can, requireSession } from '@/lib/auth/session'
import { getCommissionSummary } from '@/lib/data/commissions'
import { type RangeKey, resolveRange, todayLocal } from '@/lib/domain/dates'
import { formatCOP } from '@/lib/domain/money'

export const metadata: Metadata = { title: 'Comisiones' }
const RANGES: RangeKey[] = ['hoy', 'semana', 'quincena', 'mes', 'personalizado']

export default async function CommissionsPage({ searchParams }: PageProps<'/comisiones'>) {
  const [session, sp] = await Promise.all([requireSession(), searchParams])
  const rangeKey = parseRangeKey(sp.rango ?? 'quincena', RANGES)
  const { from, to } = resolveRange(rangeKey, todayLocal(), { from: sp.desde as string, to: sp.hasta as string })
  const canSeeAll = can(session, 'commissions.read_all')
  const rows = canSeeAll || session.staffId ? await getCommissionSummary(from, to) : []
  const canPay = can(session, 'commissions.manage')

  return (
    <>
      <PageHeader title="Comisiones" subtitle={canSeeAll ? 'Por profesional' : 'Tus comisiones'} backHref="/mas" />
      <RangePicker basePath="/comisiones" active={rangeKey} keys={RANGES} from={from} to={to} />
      <div className="mt-4 space-y-3">
        {rows.length === 0 && <EmptyState title="Sin comisiones" description="No hay profesionales con ventas en este periodo." />}
        {rows.map((r) => (
          <Card key={r.staff_id} className="space-y-3">
            <div className="flex items-baseline justify-between">
              <p className="font-display text-xl">{r.staff_name}</p>
              <p className="text-sm text-ink-muted">{Number(r.current_percent)}% actual</p>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <Stat label="Ventas" value={String(r.sales_count)} />
              <Stat label="Total vendido" value={formatCOP(r.total_sold)} />
              <Stat label="Comisión" value={formatCOP(r.commission_amount)} strong />
              {canSeeAll && <Stat label="Para el negocio" value={formatCOP(r.business_amount)} />}
              <Stat label="Pendiente de pago" value={formatCOP(r.pending_amount)} />
            </dl>
            {canPay && r.pending_amount > 0 && <MarkPaidButton staffId={r.staff_id} from={from} to={to} amount={formatCOP(r.pending_amount)} />}
          </Card>
        ))}
      </div>
      <p className="mt-4 px-1 text-xs text-ink-muted">
        Cada venta guarda el porcentaje vigente al momento de registrarse: cambiarlo después no altera ventas anteriores.
      </p>
    </>
  )
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <dt className="text-ink-muted">{label}</dt>
      <dd className={`tabular ${strong ? 'font-display text-xl' : 'font-medium'}`}>{value}</dd>
    </div>
  )
}

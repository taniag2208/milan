import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { CheckCircle2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, SectionTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ButtonLink } from '@/components/ui/button'
import { SaleAdminActions } from '@/components/ventas/sale-admin-actions'
import { can, canViewSales, requireSession } from '@/lib/auth/session'
import { getSale } from '@/lib/data/sales'
import { getPaymentMethods } from '@/lib/data/catalog'
import { formatCOP } from '@/lib/domain/money'
import { formatShortDate, formatTime, toLocalDate } from '@/lib/domain/dates'

export const metadata: Metadata = { title: 'Venta' }

export default async function SalePage({ params, searchParams }: PageProps<'/ventas/[id]'>) {
  const [{ id }, sp, session] = await Promise.all([params, searchParams, requireSession()])
  if (!canViewSales(session)) redirect('/inicio')
  const sale = await getSale(id)
  if (!sale) notFound()
  const isNew = sp.nueva === '1'
  const commission = sale.commission_records[0]
  const canManage = can(session, 'sales.manage') && sale.status === 'registrada'
  const paymentMethods = canManage ? await getPaymentMethods(true) : []

  return (
    <>
      <PageHeader title={isNew ? 'Venta registrada' : 'Venta'} subtitle={`${formatShortDate(toLocalDate(sale.sold_at))} · ${formatTime(sale.sold_at)}`} backHref={isNew ? '/inicio' : '/ventas'} />

      {isNew && (
        <div className="mb-4 flex flex-col items-center py-4 text-center">
          <CheckCircle2 className="size-14 text-success" strokeWidth={1.3} />
          <p className="mt-2 font-display text-2xl">¡Venta registrada!</p>
        </div>
      )}

      <Card className="space-y-3">
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.16em] text-ink-muted">Total</p>
          <p className="font-display text-5xl tabular">{formatCOP(sale.total)}</p>
          <p className="mt-1 text-ink-soft">{sale.payment_methods?.name}</p>
          {sale.status === 'anulada' && <Badge tone="danger" className="mt-2">Anulada: {sale.void_reason}</Badge>}
        </div>
        {commission && commission.status !== 'anulada' && (
          <div className="flex justify-between rounded-2xl bg-cream/70 px-4 py-3 text-sm">
            <span className="text-ink-soft">Comisión {sale.staff?.display_name} ({Number(commission.percent)}%)</span>
            <span className="font-medium tabular">{formatCOP(commission.commission_amount)}</span>
          </div>
        )}
      </Card>

      <SectionTitle>Detalle</SectionTitle>
      <Card className="space-y-2 text-[15px]">
        <div className="flex justify-between text-sm"><span className="text-ink-muted">Clienta</span>
          {sale.customers ? <Link href={`/clientes/${sale.customers.id}`} className="font-medium">{sale.customers.full_name}</Link> : '—'}
        </div>
        <div className="flex justify-between text-sm"><span className="text-ink-muted">Atendió</span><span className="font-medium">{sale.staff?.display_name}</span></div>
        <div className="divide-y divide-line border-y border-line">
          {sale.sale_items.map((i) => (
            <div key={i.id} className="flex justify-between gap-3 py-2">
              <span>{i.kind === 'extra' && '+ '}{i.description}{i.quantity > 1 && ` × ${i.quantity}`}</span>
              <span className="tabular text-ink-soft">{formatCOP(i.line_total)}</span>
            </div>
          ))}
        </div>
        {sale.discount > 0 && <div className="flex justify-between text-sm"><span className="text-ink-muted">Descuento</span><span className="tabular">−{formatCOP(sale.discount)}</span></div>}
        <div className="flex justify-between font-medium"><span>Total</span><span className="tabular">{formatCOP(sale.total)}</span></div>
        {can(session, 'commissions.read_all') && commission && (
          <div className="flex justify-between text-sm"><span className="text-ink-muted">Para el negocio</span><span className="tabular">{formatCOP(commission.business_amount)}</span></div>
        )}
      </Card>

      {isNew && <ButtonLink href="/inicio" size="lg" block className="mt-6">Listo</ButtonLink>}

      {canManage && (
        <>
          <SectionTitle>Administración</SectionTitle>
          <Card><SaleAdminActions saleId={sale.id} paymentMethodId={sale.payment_method_id} paymentMethods={paymentMethods} /></Card>
        </>
      )}
    </>
  )
}

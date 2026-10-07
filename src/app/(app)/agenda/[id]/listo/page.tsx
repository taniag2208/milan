import type { Metadata } from 'next'
import { CheckCircle2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { ButtonLink } from '@/components/ui/button'
import { requireSession } from '@/lib/auth/session'
import { getAppointment } from '@/lib/data/appointments'
import { formatCOP } from '@/lib/domain/money'

export const metadata: Metadata = { title: 'Venta registrada' }

/** Confirmación de cierre para quien no tiene acceso al módulo de Ventas. */
export default async function SaleDonePage({ params, searchParams }: PageProps<'/agenda/[id]/listo'>) {
  const [{ id }, sp] = await Promise.all([params, searchParams, requireSession()])
  const a = await getAppointment(id)
  const total = Number(sp.total ?? 0)
  return (
    <div className="lg:mx-auto lg:max-w-2xl">
      <PageHeader title="Venta registrada" backHref="/inicio" />
      <div className="mb-4 flex flex-col items-center py-4 text-center">
        <CheckCircle2 className="size-14 text-success" strokeWidth={1.3} />
        <p className="mt-2 font-display text-2xl">¡Venta registrada!</p>
        {a?.customers && <p className="text-ink-soft">{a.customers.full_name}</p>}
      </div>
      <Card className="text-center">
        <p className="text-xs uppercase tracking-[0.16em] text-ink-muted">Total</p>
        <p className="font-display text-5xl tabular">{formatCOP(total)}</p>
        {typeof sp.pago === 'string' && <p className="mt-1 text-ink-soft">{sp.pago}</p>}
      </Card>
      <ButtonLink href="/inicio" size="lg" block className="mt-6">Listo</ButtonLink>
      <ButtonLink href="/agenda" variant="ghost" block className="mt-2">Ver agenda</ButtonLink>
    </div>
  )
}

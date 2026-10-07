'use client'
import { useMemo, useState, useTransition } from 'react'
import { Minus, Plus, Trash2 } from 'lucide-react'
import { completeAppointment } from '@/lib/actions/appointments'
import { Button } from '@/components/ui/button'
import { Card, SectionTitle } from '@/components/ui/card'
import { Field, Input, Select } from '@/components/ui/field'
import { MoneyInput } from '@/components/ui/money-input'
import { Alert } from '@/components/ui/alert'
import { cn } from '@/components/ui/cn'
import { computeSale } from '@/lib/domain/commission'
import { formatCOP } from '@/lib/domain/money'
import type { PaymentMethod, Service, ServiceExtra, Staff } from '@/lib/types/db'

type Line = {
  key: string
  kind: 'servicio' | 'extra'
  serviceId?: string
  extraId?: string
  description: string
  listPrice: number
  unitPrice: number
  quantity: number
  commissionable: boolean
  priceIsFrom?: boolean
}

let seq = 0
const nextKey = () => `l${++seq}`

export function CloseSaleForm({
  appointmentId,
  customerName,
  initialServices,
  services,
  extras,
  staff,
  defaultStaffId,
  paymentMethods,
}: {
  appointmentId: string
  customerName: string
  initialServices: { service: Service; price: number }[]
  services: Service[]
  extras: ServiceExtra[]
  staff: Staff[]
  defaultStaffId: string
  paymentMethods: PaymentMethod[]
}) {
  const [lines, setLines] = useState<Line[]>(() =>
    initialServices.map(({ service, price }) => ({
      key: nextKey(),
      kind: 'servicio',
      serviceId: service.id,
      description: service.name,
      listPrice: price,
      unitPrice: price,
      quantity: 1,
      commissionable: service.commissionable,
      priceIsFrom: service.price_is_from,
    })),
  )
  const [discount, setDiscount] = useState(0)
  const [staffId, setStaffId] = useState(defaultStaffId)
  const [paymentId, setPaymentId] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [customExtra, setCustomExtra] = useState<{ description: string; price: number } | null>(null)
  const [pending, startTransition] = useTransition()

  const serviceLines = lines.filter((l) => l.kind === 'servicio')
  const extraLines = lines.filter((l) => l.kind === 'extra')
  const selectedServices = services.filter((s) => serviceLines.some((l) => l.serviceId === s.id))

  const applicableExtras = useMemo(() => {
    const ids = new Set(selectedServices.map((s) => s.id))
    const cats = new Set(selectedServices.map((s) => s.category_id))
    return extras.filter((e) => (e.service_id && ids.has(e.service_id)) || (e.category_id && cats.has(e.category_id)) || (!e.service_id && !e.category_id))
  }, [extras, selectedServices])

  const totals = computeSale(
    lines.map((l) => ({ unitPrice: l.unitPrice, quantity: l.quantity, commissionable: l.commissionable })),
    discount,
    0,
  )

  const update = (key: string, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  const remove = (key: string) => setLines((ls) => ls.filter((l) => l.key !== key))

  function addService(id: string) {
    const s = services.find((x) => x.id === id)
    if (!s) return
    setLines((ls) => [...ls, {
      key: nextKey(), kind: 'servicio', serviceId: s.id, description: s.name, listPrice: s.base_price,
      unitPrice: s.base_price, quantity: 1, commissionable: s.commissionable, priceIsFrom: s.price_is_from,
    }])
  }

  function addExtra(e: ServiceExtra) {
    const existing = extraLines.find((l) => l.extraId === e.id)
    if (existing) return update(existing.key, { quantity: existing.quantity + 1 })
    setLines((ls) => [...ls, {
      key: nextKey(), kind: 'extra', extraId: e.id, description: e.name, listPrice: e.price,
      unitPrice: e.price, quantity: 1, commissionable: e.commissionable,
    }])
  }

  function submit() {
    setError(null)
    if (serviceLines.length === 0) return setError('Agrega al menos un servicio.')
    if (!paymentId) return setError('Selecciona el medio de pago.')
    startTransition(async () => {
      const res = await completeAppointment({
        appointmentId,
        staffId,
        paymentMethodId: paymentId,
        discount: totals.discount,
        items: lines.map((l) => ({
          kind: l.kind,
          service_id: l.serviceId,
          extra_id: l.extraId,
          description: l.kind === 'extra' ? l.description : undefined,
          unit_price: l.unitPrice,
          quantity: l.quantity,
        })),
      })
      if (res?.error) setError(res.error)
    })
  }

  return (
    <div className="space-y-5">
      <Card className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-ink-muted">Clienta</span>
          <span className="font-medium">{customerName}</span>
        </div>
        <Field label="¿Quién atendió?" htmlFor="staff">
          <Select id="staff" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.display_name}</option>)}
          </Select>
        </Field>
      </Card>

      <section>
        <SectionTitle>Servicios</SectionTitle>
        <Card className="space-y-3">
          {serviceLines.map((l) => (
            <div key={l.key} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{l.description}</p>
                <button type="button" onClick={() => remove(l.key)} aria-label={`Quitar ${l.description}`} className="grid size-9 place-items-center rounded-full text-ink-muted hover:bg-cream">
                  <Trash2 className="size-4" />
                </button>
              </div>
              <MoneyInput value={l.unitPrice} onValueChange={(v) => update(l.key, { unitPrice: v })} />
              {l.priceIsFrom && <p className="px-1 text-xs text-ink-muted">Precio desde {formatCOP(l.listPrice)}: ajusta el valor final.</p>}
            </div>
          ))}
          <Select value="" onChange={(e) => { addService(e.target.value); e.target.value = '' }} aria-label="Agregar servicio">
            <option value="">+ Agregar otro servicio</option>
            {services.map((s) => <option key={s.id} value={s.id}>{s.name} · {formatCOP(s.base_price)}</option>)}
          </Select>
        </Card>
      </section>

      <section>
        <SectionTitle>Extras</SectionTitle>
        <Card className="space-y-3">
          {applicableExtras.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {applicableExtras.map((e) => (
                <button key={e.id} type="button" onClick={() => addExtra(e)} className="rounded-full border border-line bg-cream/60 px-3.5 py-2 text-sm">
                  + {e.name} <span className="text-ink-muted">{formatCOP(e.price)}</span>
                </button>
              ))}
            </div>
          )}
          {extraLines.map((l) => (
            <div key={l.key} className="space-y-1.5 border-t border-line pt-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{l.description}</p>
                <div className="flex items-center gap-1">
                  <button type="button" aria-label="Menos" onClick={() => (l.quantity > 1 ? update(l.key, { quantity: l.quantity - 1 }) : remove(l.key))} className="grid size-9 place-items-center rounded-full border border-line">
                    <Minus className="size-4" />
                  </button>
                  <span className="w-6 text-center tabular">{l.quantity}</span>
                  <button type="button" aria-label="Más" onClick={() => update(l.key, { quantity: l.quantity + 1 })} className="grid size-9 place-items-center rounded-full border border-line">
                    <Plus className="size-4" />
                  </button>
                </div>
              </div>
              <MoneyInput value={l.unitPrice} onValueChange={(v) => update(l.key, { unitPrice: v })} />
            </div>
          ))}
          {customExtra ? (
            <div className="space-y-2 border-t border-line pt-3">
              <Input placeholder="Descripción del extra" value={customExtra.description} onChange={(e) => setCustomExtra({ ...customExtra, description: e.target.value })} autoFocus />
              <MoneyInput value={customExtra.price} onValueChange={(v) => setCustomExtra({ ...customExtra, price: v })} />
              <div className="grid grid-cols-2 gap-2">
                <Button variant="ghost" type="button" onClick={() => setCustomExtra(null)}>Cancelar</Button>
                <Button
                  variant="soft"
                  type="button"
                  disabled={!customExtra.description.trim()}
                  onClick={() => {
                    setLines((ls) => [...ls, { key: nextKey(), kind: 'extra', description: customExtra.description.trim(), listPrice: customExtra.price, unitPrice: customExtra.price, quantity: 1, commissionable: true }])
                    setCustomExtra(null)
                  }}
                >
                  Agregar
                </Button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setCustomExtra({ description: '', price: 0 })} className="text-sm text-almond-deep">
              + Agregar otro extra
            </button>
          )}
        </Card>
      </section>

      <section>
        <SectionTitle>Descuento</SectionTitle>
        <MoneyInput value={discount} onValueChange={setDiscount} />
      </section>

      <Card className="bg-cream/70">
        <div className="flex justify-between text-sm text-ink-soft"><span>Subtotal</span><span className="tabular">{formatCOP(totals.gross)}</span></div>
        {totals.discount > 0 && (
          <div className="mt-1 flex justify-between text-sm text-ink-soft"><span>Descuento</span><span className="tabular">−{formatCOP(totals.discount)}</span></div>
        )}
        <div className="mt-2 flex items-end justify-between">
          <span className="text-xs uppercase tracking-[0.16em] text-ink-muted">Total</span>
          <span className="font-display text-4xl tabular">{formatCOP(totals.total)}</span>
        </div>
      </Card>

      <section>
        <SectionTitle>Medio de pago</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          {paymentMethods.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPaymentId(p.id)}
              aria-pressed={paymentId === p.id}
              className={cn('h-13 rounded-2xl border text-[15px]', paymentId === p.id ? 'border-ink bg-ink text-cream' : 'border-line bg-card text-ink-soft')}
            >
              {p.name}
            </button>
          ))}
        </div>
      </section>

      {error && <Alert>{error}</Alert>}

      <div className="sticky bottom-20 z-10 -mx-4 bg-gradient-to-t from-page via-page to-transparent px-4 pb-2 pt-4">
        <Button size="lg" block onClick={submit} disabled={pending} className="uppercase tracking-[0.12em]">
          {pending ? 'Registrando…' : `Confirmar venta · ${formatCOP(totals.total)}`}
        </Button>
      </div>
    </div>
  )
}

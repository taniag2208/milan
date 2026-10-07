'use client'
import { useActionState, useEffect, useMemo, useState, useTransition } from 'react'
import { CheckCircle2, UserRound } from 'lucide-react'
import { createAppointment, getAvailableTimes, lookupCustomerByPhone, updateAppointment } from '@/lib/actions/appointments'
import { Field, Input, Textarea, ChoiceChips } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { Alert } from '@/components/ui/alert'
import { Card, SectionTitle } from '@/components/ui/card'
import { ImagePicker } from '@/components/ui/image-picker'
import { cn } from '@/components/ui/cn'
import { CHANNELS } from '@/lib/domain/labels'
import { formatCOP } from '@/lib/domain/money'
import { formatDuration } from '@/lib/domain/dates'
import type { Service, Staff } from '@/lib/types/db'

type Category = { id: string; name: string; services: Service[] }

export interface AppointmentFormProps {
  mode: 'create' | 'edit'
  categories: Category[]
  staff: Staff[]
  defaults: {
    appointmentId?: string
    customer?: { id: string; full_name: string } | null
    staffId?: string
    date: string
    time?: string
    serviceIds?: string[]
    channel?: string
    notes?: string | null
    designNotes?: string | null
  }
  canOverrideHours: boolean
}

export function AppointmentForm({ mode, categories, staff, defaults, canOverrideHours }: AppointmentFormProps) {
  const [state, action] = useActionState(mode === 'create' ? createAppointment : updateAppointment, {})
  const fe = state.fieldErrors ?? {}

  const [customer, setCustomer] = useState(defaults.customer ?? null)
  const [phone, setPhone] = useState('')
  const [lookup, setLookup] = useState<'idle' | 'searching' | 'found' | 'new' | 'invalid'>(defaults.customer ? 'found' : 'idle')
  const [serviceIds, setServiceIds] = useState<string[]>(defaults.serviceIds ?? [])
  const [staffId, setStaffId] = useState(defaults.staffId ?? staff[0]?.id ?? '')
  const [date, setDate] = useState(defaults.date)
  const [time, setTime] = useState(defaults.time ?? '')
  const [slots, setSlots] = useState<string[] | null>(null)
  const [loadingSlots, startSlots] = useTransition()

  const allServices = useMemo(() => categories.flatMap((c) => c.services), [categories])
  const selected = allServices.filter((s) => serviceIds.includes(s.id))
  const totalPrice = selected.reduce((s, x) => s + x.base_price, 0)
  const totalDuration = selected.reduce((s, x) => s + x.duration_min, 0)

  // Busca la clienta por teléfono para no duplicarla.
  async function checkPhone(value: string) {
    if (mode === 'edit' || defaults.customer) return
    const digits = value.replace(/\D/g, '')
    if (digits.length < 7) {
      setLookup('idle')
      setCustomer(null)
      return
    }
    setLookup('searching')
    const res = await lookupCustomerByPhone(value)
    if (!res.valid) {
      setLookup('invalid')
      setCustomer(null)
    } else if (res.customer) {
      setCustomer({ id: res.customer.id, full_name: res.customer.full_name })
      setLookup('found')
    } else {
      setCustomer(null)
      setLookup('new')
    }
  }

  // Horarios libres reales para la combinación elegida.
  useEffect(() => {
    if (!date || !staffId || serviceIds.length === 0) {
      setSlots(null)
      return
    }
    startSlots(async () => {
      const result = await getAvailableTimes(date, serviceIds, staffId)
      setSlots(result)
    })
  }, [date, staffId, serviceIds])

  const toggleService = (id: string) =>
    setServiceIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  return (
    <form action={action} className="space-y-5">
      {state.error && <Alert>{state.error}</Alert>}
      {defaults.appointmentId && <input type="hidden" name="appointment_id" value={defaults.appointmentId} />}
      {customer && <input type="hidden" name="customer_id" value={customer.id} />}

      {/* Clienta */}
      <section>
        <SectionTitle>Clienta</SectionTitle>
        {mode === 'edit' || defaults.customer ? (
          <Card className="flex items-center gap-3">
            <UserRound className="size-5 text-taupe" />
            <span className="font-medium">{customer?.full_name}</span>
          </Card>
        ) : (
          <div className="space-y-3">
            <Field label="Teléfono" error={fe.phone ?? (lookup === 'invalid' ? 'Teléfono inválido' : undefined)} htmlFor="phone">
              <Input
                id="phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="300 123 4567"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value)
                  if (e.target.value.replace(/\D/g, '').length >= 10) checkPhone(e.target.value)
                }}
                onBlur={(e) => checkPhone(e.target.value)}
                autoFocus
              />
            </Field>
            {lookup === 'searching' && <p className="px-1 text-sm text-ink-muted">Buscando clienta…</p>}
            {lookup === 'found' && customer && (
              <div className="flex items-center gap-2 rounded-2xl bg-success-soft px-4 py-3 text-sm text-success">
                <CheckCircle2 className="size-4" />
                <span>Clienta registrada: <strong className="font-medium">{customer.full_name}</strong></span>
              </div>
            )}
            {lookup !== 'found' && (
              <Field label="Nombre" error={fe.name} htmlFor="name" hint={lookup === 'new' ? 'Clienta nueva: se creará con este teléfono.' : undefined}>
                <Input id="name" name="name" autoComplete="name" autoCapitalize="words" placeholder="Nombre y apellido" />
              </Field>
            )}
          </div>
        )}
      </section>

      {/* Servicios */}
      <section>
        <SectionTitle>Servicio</SectionTitle>
        {fe.service_ids && <p className="mb-2 px-1 text-sm text-danger">{fe.service_ids}</p>}
        <div className="space-y-3">
          {categories.map((c) => (
            <div key={c.id}>
              <p className="mb-1.5 px-1 text-xs text-ink-muted">{c.name}</p>
              <div className="flex flex-wrap gap-2">
                {c.services.map((s) => {
                  const on = serviceIds.includes(s.id)
                  return (
                    <button
                      type="button"
                      key={s.id}
                      onClick={() => toggleService(s.id)}
                      aria-pressed={on}
                      className={cn(
                        'rounded-2xl border px-3.5 py-2 text-left text-sm transition-colors',
                        on ? 'border-ink bg-ink text-cream' : 'border-line bg-card text-ink',
                      )}
                    >
                      <span className="block">{s.name}</span>
                      <span className={cn('block text-xs', on ? 'text-cream/70' : 'text-ink-muted')}>
                        {s.price_is_from ? 'desde ' : ''}{formatCOP(s.base_price)}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
        {serviceIds.map((id) => <input key={id} type="hidden" name="service_ids" value={id} />)}
        {selected.length > 0 && (
          <p className="mt-3 px-1 text-sm text-ink-soft">
            {formatDuration(totalDuration)} · <span className="tabular">{formatCOP(totalPrice)}</span>
          </p>
        )}
      </section>

      {/* Profesional */}
      <section>
        <SectionTitle>Profesional</SectionTitle>
        {fe.staff_id && <p className="mb-2 px-1 text-sm text-danger">{fe.staff_id}</p>}
        <div className="grid grid-cols-2 gap-2">
          {staff.map((s) => (
            <button
              type="button"
              key={s.id}
              onClick={() => setStaffId(s.id)}
              aria-pressed={staffId === s.id}
              className={cn(
                'flex h-12 items-center justify-center gap-2 rounded-2xl border text-[15px]',
                staffId === s.id ? 'border-ink bg-ink text-cream' : 'border-line bg-card text-ink-soft',
              )}
            >
              <span className="size-2 rounded-full" style={{ background: s.color }} />
              {s.display_name}
            </button>
          ))}
        </div>
        <input type="hidden" name="staff_id" value={staffId} />
      </section>

      {/* Fecha y hora */}
      <section>
        <SectionTitle>Fecha y hora</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha" error={fe.date} htmlFor="date">
            <Input id="date" name="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </Field>
          <Field label="Hora" error={fe.time} htmlFor="time">
            <Input id="time" name="time" type="time" step={900} value={time} onChange={(e) => setTime(e.target.value)} required />
          </Field>
        </div>
        {serviceIds.length > 0 && (
          <div className="mt-3">
            <p className="mb-2 px-1 text-xs text-ink-muted">
              {loadingSlots ? 'Consultando disponibilidad…' : slots && slots.length > 0 ? 'Horarios disponibles' : slots ? 'Sin horarios libres ese día para esta profesional.' : ''}
            </p>
            {slots && slots.length > 0 && (
              <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
                {slots.map((t) => (
                  <button
                    type="button"
                    key={t}
                    onClick={() => setTime(t)}
                    className={cn(
                      'h-10 shrink-0 rounded-full border px-4 text-sm tabular',
                      time === t ? 'border-ink bg-ink text-cream' : 'border-line bg-card text-ink-soft',
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {canOverrideHours && (
          <label className="mt-3 flex items-center gap-2 px-1 text-sm text-ink-soft">
            <input type="checkbox" name="allow_outside_hours" className="size-4 accent-ink" /> Permitir fuera del horario de atención
          </label>
        )}
      </section>

      {/* Detalles */}
      <section className="space-y-3">
        <SectionTitle>Detalles</SectionTitle>
        <Field label="Canal de origen">
          <ChoiceChips
            name="channel"
            columns={3}
            defaultValue={defaults.channel ?? 'whatsapp'}
            options={Object.entries(CHANNELS).map(([value, label]) => ({ value, label }))}
          />
        </Field>
        <Field label="Diseño solicitado" htmlFor="design_notes">
          <Textarea id="design_notes" name="design_notes" defaultValue={defaults.designNotes ?? ''} placeholder="Ej. francesa nude, almendra corta" />
        </Field>
        <Field label="Referencia (opcional)" error={fe.reference}>
          <ImagePicker name="reference" label="Foto del diseño" />
        </Field>
        <Field label="Notas" htmlFor="notes">
          <Textarea id="notes" name="notes" defaultValue={defaults.notes ?? ''} placeholder="Notas internas" />
        </Field>
        {mode === 'create' && (
          <label className="flex items-center gap-2 px-1 text-sm text-ink-soft">
            <input type="checkbox" name="confirmed" className="size-4 accent-ink" /> La clienta ya confirmó
          </label>
        )}
      </section>

      <div className="sticky bottom-20 z-10 -mx-4 bg-gradient-to-t from-page via-page to-transparent px-4 pb-2 pt-4">
        <SubmitButton size="lg" block>{mode === 'create' ? 'Guardar cita' : 'Guardar cambios'}</SubmitButton>
      </div>
    </form>
  )
}

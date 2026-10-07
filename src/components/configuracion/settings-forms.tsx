'use client'
import { useActionState } from 'react'
import { saveBusiness, saveCrmRules, saveHours, saveOperations, savePaymentMethod } from '@/lib/actions/settings'
import { Field, Input, Select } from '@/components/ui/field'
import { MoneyInput } from '@/components/ui/money-input'
import { SubmitButton } from '@/components/ui/submit-button'
import { Alert } from '@/components/ui/alert'
import type { BusinessInfo, CrmRules, OpeningHours, PaymentMethod } from '@/lib/types/db'
import type { ActionState } from '@/lib/errors'

function Feedback({ state }: { state: ActionState }) {
  if (state.error) return <Alert>{state.error}</Alert>
  if (state.message) return <Alert tone="success">{state.message}</Alert>
  return null
}

export function BusinessForm({ business }: { business: BusinessInfo }) {
  const [state, action] = useActionState(saveBusiness, {})
  return (
    <form action={action} className="space-y-3">
      <Field label="Nombre"><Input name="name" defaultValue={business.name} /></Field>
      <Field label="Dirección"><Input name="address" defaultValue={business.address ?? ''} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Teléfono"><Input name="phone" type="tel" defaultValue={business.phone ?? ''} /></Field>
        <Field label="Instagram"><Input name="instagram" defaultValue={business.instagram ?? ''} /></Field>
      </div>
      <Feedback state={state} />
      <SubmitButton block variant="soft">Guardar datos</SubmitButton>
    </form>
  )
}

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

export function HoursForm({ hours }: { hours: OpeningHours }) {
  const [state, action] = useActionState(saveHours, {})
  return (
    <form action={action} className="space-y-2">
      {DAYS.map((name, i) => {
        const d = String(i + 1) as keyof OpeningHours
        const h = hours[d]
        return (
          <div key={d} className="flex items-center gap-2">
            <label className="flex w-28 items-center gap-2 text-sm">
              <input type="checkbox" name={`enabled_${d}`} defaultChecked={!!h} className="size-4 accent-ink" />
              {name}
            </label>
            <input type="time" name={`open_${d}`} defaultValue={h?.open ?? '09:00'} className="h-10 flex-1 rounded-xl border border-line bg-card px-2 text-sm" />
            <span className="text-ink-muted">–</span>
            <input type="time" name={`close_${d}`} defaultValue={h?.close ?? '19:00'} className="h-10 flex-1 rounded-xl border border-line bg-card px-2 text-sm" />
          </div>
        )
      })}
      <p className="px-1 text-xs text-ink-muted">Días sin marcar = cerrado.</p>
      <Feedback state={state} />
      <SubmitButton block variant="soft">Guardar horario</SubmitButton>
    </form>
  )
}

export function OperationsForm({ slotMinutes, commissionBase, staffCanCreate }: { slotMinutes: number; commissionBase: string; staffCanCreate: boolean }) {
  const [state, action] = useActionState(saveOperations, {})
  return (
    <form action={action} className="space-y-3">
      <Field label="Intervalo de horarios en agenda">
        <Select name="slot_minutes" defaultValue={String(slotMinutes)}>
          {[15, 20, 30, 45, 60].map((m) => <option key={m} value={m}>Cada {m} minutos</option>)}
        </Select>
      </Field>
      <Field label="Base de la comisión">
        <Select name="commission_base" defaultValue={commissionBase}>
          <option value="neto">Valor cobrado (después de descuento)</option>
          <option value="bruto">Valor del servicio (antes de descuento)</option>
        </Select>
      </Field>
      <label className="flex items-center justify-between rounded-2xl border border-line bg-card px-4 py-3 text-[15px]">
        Colaboradoras pueden crear citas
        <input type="checkbox" name="staff_can_create" defaultChecked={staffCanCreate} className="size-5 accent-ink" />
      </label>
      <Feedback state={state} />
      <SubmitButton block variant="soft">Guardar</SubmitButton>
    </form>
  )
}

export function CrmRulesForm({ rules, categories }: { rules: CrmRules; categories: string[] }) {
  const [state, action] = useActionState(saveCrmRules, {})
  const num = (name: keyof CrmRules, label: string, hint?: string) => (
    <Field label={label} hint={hint}><Input name={name} type="number" inputMode="numeric" min={0} defaultValue={rules[name] as number} /></Field>
  )
  return (
    <form action={action} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {num('recurring_min_visits', 'Recurrente desde (visitas)')}
        {num('inactive_days', 'Inactiva tras (días)')}
        {num('vip_min_visits', 'VIP: visitas')}
        {num('vip_window_days', 'VIP: periodo (días)')}
      </div>
      <Field label="VIP: gasto mínimo en el periodo"><MoneyInput name="vip_min_spent" defaultValue={rules.vip_min_spent} /></Field>
      <p className="px-1 pt-2 text-sm font-medium text-ink-soft">Por reactivar: días sin volver según categoría</p>
      <div className="grid grid-cols-2 gap-3">
        {categories.map((c) => (
          <Field key={c} label={c}><Input name={`react_${c}`} type="number" min={1} defaultValue={rules.reactivation_days?.[c] ?? ''} /></Field>
        ))}
        {num('reactivation_default_days', 'Otras categorías')}
        {num('birthday_window_days', 'Aviso cumpleaños (días)')}
      </div>
      <Feedback state={state} />
      <SubmitButton block variant="soft">Guardar reglas</SubmitButton>
    </form>
  )
}

function PaymentRow({ method }: { method?: PaymentMethod }) {
  const [state, action] = useActionState(savePaymentMethod, {})
  return (
    <form action={action} className="flex items-center gap-2 py-2" key={state.message}>
      {method && <input type="hidden" name="id" value={method.id} />}
      <Input name="name" defaultValue={method?.name} placeholder="Nuevo medio de pago" className="h-11 flex-1" />
      {method && <input type="checkbox" name="is_active" defaultChecked={method.is_active} aria-label="Activo" className="size-5 accent-ink" />}
      <SubmitButton size="sm" variant={method ? 'ghost' : 'soft'} pendingText="…">{method ? 'Guardar' : 'Agregar'}</SubmitButton>
      {state.error && <span className="text-xs text-danger">{state.error}</span>}
    </form>
  )
}

export function PaymentMethodsForm({ methods }: { methods: PaymentMethod[] }) {
  return (
    <div className="divide-y divide-line">
      {methods.map((m) => <PaymentRow key={m.id} method={m} />)}
      <PaymentRow />
    </div>
  )
}

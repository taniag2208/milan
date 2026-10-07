'use client'
import { useActionState } from 'react'
import { createCustomer, updateCustomer } from '@/lib/actions/customers'
import { Field, Input, Textarea, Select } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { Alert } from '@/components/ui/alert'
import { CHANNELS, CUSTOMER_STATUS } from '@/lib/domain/labels'
import { formatPhone } from '@/lib/domain/phone'
import type { Customer } from '@/lib/types/db'

export function CustomerForm({ customer }: { customer?: Customer }) {
  const [state, action] = useActionState(customer ? updateCustomer : createCustomer, {})
  const fe = state.fieldErrors ?? {}
  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert>{state.error}</Alert>}
      {customer && <input type="hidden" name="id" value={customer.id} />}
      <Field label="Nombre" error={fe.full_name} htmlFor="full_name">
        <Input id="full_name" name="full_name" defaultValue={customer?.full_name} autoCapitalize="words" required autoFocus={!customer} />
      </Field>
      <Field label="Teléfono" error={fe.phone} htmlFor="phone">
        <Input id="phone" name="phone" type="tel" inputMode="tel" defaultValue={formatPhone(customer?.phone_e164)} required placeholder="300 123 4567" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Cumpleaños" error={fe.birth_date} htmlFor="birth_date">
          <Input id="birth_date" name="birth_date" type="date" defaultValue={customer?.birth_date ?? ''} />
        </Field>
        <Field label="Instagram" htmlFor="instagram">
          <Input id="instagram" name="instagram" defaultValue={customer?.instagram ?? ''} placeholder="@usuario" autoCapitalize="none" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Origen" htmlFor="source">
          <Select id="source" name="source" defaultValue={customer?.source ?? 'presencial'}>
            {Object.entries(CHANNELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </Field>
        {customer && (
          <Field label="Estado" htmlFor="status">
            <Select id="status" name="status" defaultValue={customer.status}>
              {Object.entries(CUSTOMER_STATUS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
        )}
      </div>
      <Field label="Notas" htmlFor="notes">
        <Textarea id="notes" name="notes" defaultValue={customer?.notes ?? ''} placeholder="Alergias, preferencias…" />
      </Field>
      <label className="flex items-start gap-3 rounded-2xl border border-line bg-card px-4 py-3 text-sm text-ink-soft">
        <input type="checkbox" name="marketing_consent" defaultChecked={customer?.marketing_consent} className="mt-0.5 size-4 accent-ink" />
        Acepta recibir mensajes de promociones y recordatorios
      </label>
      <SubmitButton size="lg" block>{customer ? 'Guardar cambios' : 'Crear clienta'}</SubmitButton>
    </form>
  )
}

'use client'
import { useActionState } from 'react'
import { saveService } from '@/lib/actions/services'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { MoneyInput } from '@/components/ui/money-input'
import { SubmitButton } from '@/components/ui/submit-button'
import { Alert } from '@/components/ui/alert'
import type { Service, ServiceCategory } from '@/lib/types/db'

function Toggle({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-center justify-between rounded-2xl border border-line bg-card px-4 py-3 text-[15px]">
      {label}
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="size-5 accent-ink" />
    </label>
  )
}

export function ServiceForm({ service, categories }: { service?: Service; categories: ServiceCategory[] }) {
  const [state, action] = useActionState(saveService, {})
  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert>{state.error}</Alert>}
      {service && <input type="hidden" name="id" value={service.id} />}
      <Field label="Categoría">
        <Select name="category_id" defaultValue={service?.category_id ?? categories[0]?.id} required>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </Field>
      <Field label="Nombre del servicio"><Input name="name" defaultValue={service?.name} required /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Precio base"><MoneyInput name="base_price" defaultValue={service?.base_price ?? null} required /></Field>
        <Field label="Duración (min)"><Input name="duration_min" type="number" inputMode="numeric" min={5} step={5} defaultValue={service?.duration_min ?? 60} required /></Field>
      </div>
      <Toggle name="price_is_from" label="Precio “desde” (se ajusta al cobrar)" defaultChecked={service?.price_is_from} />
      <Toggle name="commissionable" label="Aplica comisión" defaultChecked={service?.commissionable ?? true} />
      <Toggle name="is_active" label="Activo" defaultChecked={service?.is_active ?? true} />
      <Field label="Descripción"><Textarea name="description" defaultValue={service?.description ?? ''} placeholder="Opcional" /></Field>
      <SubmitButton block size="lg">{service ? 'Guardar cambios' : 'Crear servicio'}</SubmitButton>
      {service && <p className="px-1 text-xs text-ink-muted">Cambiar el precio no altera citas ni ventas ya registradas. El cambio queda auditado.</p>}
    </form>
  )
}

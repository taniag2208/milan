'use client'
import { useActionState, useState } from 'react'
import { createCategory, saveExtra } from '@/lib/actions/services'
import { Input, Select } from '@/components/ui/field'
import { MoneyInput } from '@/components/ui/money-input'
import { SubmitButton } from '@/components/ui/submit-button'
import { Alert } from '@/components/ui/alert'
import { formatCOP } from '@/lib/domain/money'
import type { Service, ServiceCategory, ServiceExtra } from '@/lib/types/db'

function scopeOf(e?: ServiceExtra) {
  if (e?.service_id) return `service:${e.service_id}`
  if (e?.category_id) return `category:${e.category_id}`
  return 'all'
}

function ExtraRow({ extra, categories, services }: { extra?: ServiceExtra; categories: ServiceCategory[]; services: Service[] }) {
  const [state, action] = useActionState(saveExtra, {})
  const [editing, setEditing] = useState(!extra)
  if (extra && !editing) {
    const scope = extra.service_id ? services.find((s) => s.id === extra.service_id)?.name : extra.category_id ? categories.find((c) => c.id === extra.category_id)?.name : 'Todos'
    return (
      <button type="button" onClick={() => setEditing(true)} className="flex w-full items-center justify-between py-3 text-left">
        <span>
          <span className={extra.is_active ? '' : 'text-ink-muted line-through'}>{extra.name}</span>
          <span className="block text-xs text-ink-muted">{scope}</span>
        </span>
        <span className="tabular text-ink-soft">{formatCOP(extra.price)}</span>
      </button>
    )
  }
  return (
    <form action={action} className="space-y-2 py-3" key={state.message}>
      {extra && <input type="hidden" name="id" value={extra.id} />}
      <Input name="name" defaultValue={extra?.name} placeholder="Nombre del extra (ej. Diseño)" required />
      <div className="grid grid-cols-2 gap-2">
        <MoneyInput name="price" defaultValue={extra?.price ?? null} />
        <Select name="scope" defaultValue={scopeOf(extra)}>
          <option value="all">Todos los servicios</option>
          {categories.map((c) => <option key={c.id} value={`category:${c.id}`}>{c.name}</option>)}
          {services.map((s) => <option key={s.id} value={`service:${s.id}`}>{s.name}</option>)}
        </Select>
      </div>
      {extra && (
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          <input type="checkbox" name="is_active" defaultChecked={extra.is_active} className="size-4 accent-ink" /> Activo
        </label>
      )}
      {state.error && <Alert>{state.error}</Alert>}
      {state.message && <Alert tone="success">{state.message}</Alert>}
      <SubmitButton size="sm" block variant={extra ? 'primary' : 'soft'}>{extra ? 'Guardar extra' : '+ Agregar extra'}</SubmitButton>
    </form>
  )
}

export function ExtrasManager({ extras, categories, services }: { extras: ServiceExtra[]; categories: ServiceCategory[]; services: Service[] }) {
  return (
    <div className="divide-y divide-line">
      {extras.map((e) => <ExtraRow key={e.id} extra={e} categories={categories} services={services} />)}
      <ExtraRow categories={categories} services={services} />
    </div>
  )
}

export function CategoryForm() {
  const [state, action] = useActionState(createCategory, {})
  return (
    <form action={action} className="flex gap-2" key={state.message}>
      <Input name="name" placeholder="Nueva categoría" className="flex-1" />
      <SubmitButton variant="soft" pendingText="…">Crear</SubmitButton>
      {state.error && <Alert className="mt-2">{state.error}</Alert>}
    </form>
  )
}

'use client'
import { useActionState } from 'react'
import { createInventoryItem, updateInventoryItem } from '@/lib/actions/inventory'
import { Field, Input, Select } from '@/components/ui/field'
import { MoneyInput } from '@/components/ui/money-input'
import { SubmitButton } from '@/components/ui/submit-button'
import { Alert } from '@/components/ui/alert'
import type { InventoryItem } from '@/lib/types/db'

export function ItemForm({ item, categories }: { item?: InventoryItem; categories: string[] }) {
  const [state, action] = useActionState(item ? updateInventoryItem : createInventoryItem, {})
  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert>{state.error}</Alert>}
      {state.message && <Alert tone="success">{state.message}</Alert>}
      {item && <input type="hidden" name="id" value={item.id} />}
      <Field label="Nombre"><Input name="name" defaultValue={item?.name} required /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Categoría">
          <Input name="category" list="inventory-categories" defaultValue={item?.category ?? ''} placeholder="Insumos" />
          <datalist id="inventory-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
        <Field label="Unidad"><Input name="unit" defaultValue={item?.unit ?? 'unidad'} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {!item && <Field label="Cantidad actual"><Input name="initial_quantity" inputMode="decimal" placeholder="0" /></Field>}
        <Field label="Stock mínimo"><Input name="min_stock" inputMode="decimal" defaultValue={item?.min_stock ?? 0} /></Field>
      </div>
      <Field label="Proveedor"><Input name="supplier" defaultValue={item?.supplier ?? ''} placeholder="Opcional" /></Field>
      <Field label="Costo unitario"><MoneyInput name="unit_cost" defaultValue={item?.unit_cost ?? null} /></Field>
      {item && (
        <Field label="Estado">
          <Select name="is_active" defaultValue={item.is_active ? 'on' : 'off'}>
            <option value="on">Activo</option>
            <option value="off">Inactivo (oculto)</option>
          </Select>
        </Field>
      )}
      {!item && <p className="px-1 text-xs text-ink-muted">La cantidad inicial se registra como movimiento de entrada.</p>}
      <SubmitButton block size="lg">{item ? 'Guardar cambios' : 'Crear producto'}</SubmitButton>
    </form>
  )
}

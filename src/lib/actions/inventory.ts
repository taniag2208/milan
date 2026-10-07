'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { friendlyError, type ActionState } from '@/lib/errors'
import { MOVEMENT_TYPES } from '@/lib/domain/labels'

const num = (v: FormDataEntryValue | null) => {
  const s = String(v ?? '').replace(',', '.').trim()
  return s === '' ? undefined : Number(s)
}

const itemSchema = z.object({
  name: z.string().trim().min(2, 'Escribe el nombre'),
  category: z.string().trim().max(60).optional(),
  unit: z.string().trim().max(30).optional(),
  min_stock: z.number({ error: 'Número inválido' }).min(0).default(0),
  supplier: z.string().trim().max(120).optional(),
  unit_cost: z.number().int().min(0).optional(),
})

export async function createInventoryItem(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = itemSchema.safeParse({
    name: formData.get('name'),
    category: (formData.get('category') as string) || undefined,
    unit: (formData.get('unit') as string) || undefined,
    min_stock: num(formData.get('min_stock')),
    supplier: (formData.get('supplier') as string) || undefined,
    unit_cost: num(formData.get('unit_cost')),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message }
  const initial = num(formData.get('initial_quantity')) ?? 0
  if (Number.isNaN(initial) || initial < 0) return { error: 'Cantidad inicial inválida' }
  const v = parsed.data
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('create_inventory_item', {
    p_name: v.name,
    p_category: v.category ?? null,
    p_unit: v.unit ?? null,
    p_min_stock: v.min_stock,
    p_initial_quantity: initial,
    p_supplier: v.supplier ?? null,
    p_unit_cost: v.unit_cost ?? null,
  })
  if (error) return { error: friendlyError(error) }
  revalidatePath('/inventario')
  redirect(`/inventario/${data}?ok=creado`)
}

export async function updateInventoryItem(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get('id') ?? '')
  const parsed = itemSchema.safeParse({
    name: formData.get('name'),
    category: (formData.get('category') as string) || undefined,
    unit: (formData.get('unit') as string) || undefined,
    min_stock: num(formData.get('min_stock')),
    supplier: (formData.get('supplier') as string) || undefined,
    unit_cost: num(formData.get('unit_cost')),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message }
  const v = parsed.data
  const supabase = await createClient()
  const { error } = await supabase
    .from('inventory_items')
    .update({
      name: v.name,
      category: v.category || 'General',
      unit: v.unit || 'unidad',
      min_stock: v.min_stock,
      supplier: v.supplier ?? null,
      unit_cost: v.unit_cost ?? null,
      is_active: formData.get('is_active') !== 'off',
    })
    .eq('id', id)
  if (error) return { error: friendlyError(error) }
  revalidatePath(`/inventario/${id}`)
  return { ok: true, message: 'Producto actualizado' }
}

export async function registerMovement(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const itemId = String(formData.get('item_id') ?? '')
  const type = String(formData.get('movement_type') ?? '')
  const quantity = num(formData.get('quantity'))
  if (!(type in MOVEMENT_TYPES)) return { error: 'Selecciona el tipo de movimiento' }
  if (quantity === undefined || Number.isNaN(quantity) || quantity < 0) return { error: 'Escribe una cantidad válida' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('register_inventory_movement', {
    p_item_id: itemId,
    p_type: type,
    p_quantity: quantity,
    p_reason: (formData.get('reason') as string) || null,
    p_note: (formData.get('note') as string) || null,
  })
  if (error) return { error: friendlyError(error) }
  revalidatePath(`/inventario/${itemId}`)
  revalidatePath('/inventario')
  return { ok: true, message: 'Movimiento registrado' }
}

'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { friendlyError, type ActionState } from '@/lib/errors'

const serviceSchema = z.object({
  category_id: z.uuid({ error: 'Selecciona la categoría' }),
  name: z.string().trim().min(2, 'Escribe el nombre'),
  base_price: z.number().int().min(0, 'Precio inválido'),
  price_is_from: z.boolean(),
  duration_min: z.number().int().min(5, 'Duración mínima 5 min').max(600),
  commissionable: z.boolean(),
  is_active: z.boolean(),
  description: z.string().trim().max(500).optional(),
})

function parseService(fd: FormData) {
  return serviceSchema.safeParse({
    category_id: fd.get('category_id'),
    name: fd.get('name'),
    base_price: Number(fd.get('base_price') || 0),
    price_is_from: fd.get('price_is_from') === 'on',
    duration_min: Number(fd.get('duration_min') || 0),
    commissionable: fd.get('commissionable') === 'on',
    is_active: fd.get('is_active') === 'on',
    description: (fd.get('description') as string) || undefined,
  })
}

export async function saveService(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const id = (fd.get('id') as string) || null
  const parsed = parseService(fd)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message }
  const row = { ...parsed.data, description: parsed.data.description ?? null }
  const supabase = await createClient()
  const { error } = id
    ? await supabase.from('services').update(row).eq('id', id)
    : await supabase.from('services').insert(row)
  if (error) return { error: friendlyError(error) }
  revalidatePath('/servicios')
  redirect('/servicios?ok=guardado')
}

export async function createCategory(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const name = String(fd.get('name') ?? '').trim().toUpperCase()
  if (name.length < 2) return { error: 'Escribe el nombre de la categoría' }
  const supabase = await createClient()
  const { count } = await supabase.from('service_categories').select('id', { count: 'exact', head: true })
  const { error } = await supabase.from('service_categories').insert({ name, sort_order: (count ?? 0) + 1 })
  if (error) return { error: friendlyError(error) }
  revalidatePath('/servicios')
  return { ok: true, message: 'Categoría creada' }
}

const extraSchema = z.object({
  name: z.string().trim().min(2, 'Escribe el nombre del extra'),
  price: z.number().int().min(0),
  scope: z.string(),
  is_active: z.boolean(),
})

export async function saveExtra(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const id = (fd.get('id') as string) || null
  const parsed = extraSchema.safeParse({
    name: fd.get('name'),
    price: Number(fd.get('price') || 0),
    scope: String(fd.get('scope') ?? 'all'),
    is_active: id ? fd.get('is_active') === 'on' : true,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message }
  const [kind, scopeId] = parsed.data.scope.split(':')
  const row = {
    name: parsed.data.name,
    price: parsed.data.price,
    is_active: parsed.data.is_active,
    service_id: kind === 'service' ? scopeId : null,
    category_id: kind === 'category' ? scopeId : null,
  }
  const supabase = await createClient()
  const { error } = id
    ? await supabase.from('service_extras').update(row).eq('id', id)
    : await supabase.from('service_extras').insert(row)
  if (error) return { error: friendlyError(error) }
  revalidatePath('/servicios')
  return { ok: true, message: id ? 'Extra actualizado' : 'Extra creado' }
}

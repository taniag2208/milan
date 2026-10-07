'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { friendlyError, type ActionState } from '@/lib/errors'
import { uploadImage } from '@/lib/storage'
import { POLISH_STATUS, POLISH_TYPES } from '@/lib/domain/labels'

const schema = z.object({
  brand: z.string().trim().min(1, 'Escribe la marca'),
  color_name: z.string().trim().min(1, 'Escribe el nombre o color'),
  reference: z.string().trim().max(60).optional(),
  polish_type: z.enum(Object.keys(POLISH_TYPES) as [string, ...string[]]),
  received_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().max(1000).optional(),
})

function parse(formData: FormData) {
  return schema.safeParse({
    brand: formData.get('brand'),
    color_name: formData.get('color_name'),
    reference: (formData.get('reference') as string) || undefined,
    polish_type: formData.get('polish_type') || 'semipermanente',
    received_at: (formData.get('received_at') as string) || undefined,
    notes: (formData.get('notes') as string) || undefined,
  })
}

export async function createPolish(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parse(formData)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message }
  const upload = await uploadImage('esmaltes', formData.get('photo') as File | null)
  if (upload.error) return { error: upload.error }
  const supabase = await createClient()
  const code = String(formData.get('code') ?? '').trim()
  const { data, error } = await supabase
    .from('nail_polishes')
    .insert({ ...parsed.data, ...(code ? { code } : {}), photo_path: upload.path })
    .select('id')
    .single()
  if (error) return { error: friendlyError(error) }
  revalidatePath('/esmaltes')
  if (formData.get('another') === '1') redirect('/esmaltes/nuevo?ok=creado')
  redirect(`/esmaltes/${data.id}?ok=creado`)
}

export async function updatePolish(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get('id') ?? '')
  const parsed = parse(formData)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message }
  const upload = await uploadImage('esmaltes', formData.get('photo') as File | null)
  if (upload.error) return { error: upload.error }
  const supabase = await createClient()
  const { error } = await supabase
    .from('nail_polishes')
    .update({ ...parsed.data, reference: parsed.data.reference ?? null, notes: parsed.data.notes ?? null, ...(upload.path ? { photo_path: upload.path } : {}) })
    .eq('id', id)
  if (error) return { error: friendlyError(error) }
  revalidatePath(`/esmaltes/${id}`)
  return { ok: true, message: 'Esmalte actualizado' }
}

export async function changePolishStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get('polish_id') ?? '')
  const status = String(formData.get('status') ?? '')
  if (!(status in POLISH_STATUS)) return { error: 'Estado inválido' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('change_polish_status', {
    p_polish_id: id,
    p_status: status,
    p_reason: (formData.get('reason') as string) || null,
    p_comment: (formData.get('comment') as string) || null,
  })
  if (error) return { error: friendlyError(error) }
  revalidatePath('/esmaltes')
  revalidatePath(`/esmaltes/${id}`)
  return { ok: true, message: `Reportado: ${POLISH_STATUS[status as keyof typeof POLISH_STATUS]}` }
}

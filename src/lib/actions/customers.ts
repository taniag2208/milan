'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { friendlyError, type ActionState } from '@/lib/errors'
import { normalizePhone } from '@/lib/domain/phone'
import { CHANNELS, CUSTOMER_STATUS } from '@/lib/domain/labels'

const schema = z.object({
  full_name: z.string().trim().min(2, 'Escribe el nombre'),
  phone: z.string().trim().refine((v) => normalizePhone(v) !== null, 'Teléfono inválido'),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
  instagram: z.string().trim().max(60).optional(),
  source: z.enum(Object.keys(CHANNELS) as [string, ...string[]]),
  notes: z.string().max(2000).optional(),
  status: z.enum(Object.keys(CUSTOMER_STATUS) as [string, ...string[]]).optional(),
  marketing_consent: z.boolean(),
})

function parse(formData: FormData) {
  return schema.safeParse({
    full_name: formData.get('full_name'),
    phone: formData.get('phone'),
    birth_date: formData.get('birth_date') ?? '',
    instagram: (formData.get('instagram') as string) || undefined,
    source: formData.get('source') || 'presencial',
    notes: (formData.get('notes') as string) || undefined,
    status: (formData.get('status') as string) || undefined,
    marketing_consent: formData.get('marketing_consent') === 'on',
  })
}

function toRow(v: z.infer<typeof schema>) {
  return {
    full_name: v.full_name,
    phone_e164: normalizePhone(v.phone),
    birth_date: v.birth_date || null,
    instagram: v.instagram || null,
    source: v.source,
    notes: v.notes || null,
    marketing_consent: v.marketing_consent,
    ...(v.status ? { status: v.status } : {}),
  }
}

function errorsOf(error: z.ZodError) {
  return Object.fromEntries(error.issues.map((i) => [String(i.path[0]), i.message]))
}

export async function createCustomer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parse(formData)
  if (!parsed.success) return { fieldErrors: errorsOf(parsed.error), error: 'Revisa los campos marcados.' }
  const supabase = await createClient()
  const { data: existing } = await supabase.rpc('find_customer_by_phone', { p_phone: parsed.data.phone })
  const dup = (existing as { id: string; full_name: string }[] | null)?.[0]
  if (dup) return { error: `Ya existe una clienta con ese teléfono: ${dup.full_name}.`, fieldErrors: { phone: 'Teléfono ya registrado' } }
  const { data, error } = await supabase.from('customers').insert(toRow(parsed.data)).select('id').single()
  if (error) return { error: friendlyError(error) }
  revalidatePath('/clientes')
  redirect(`/clientes/${data.id}?ok=creada_clienta`)
}

export async function updateCustomer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get('id') ?? '')
  const parsed = parse(formData)
  if (!parsed.success) return { fieldErrors: errorsOf(parsed.error), error: 'Revisa los campos marcados.' }
  const supabase = await createClient()
  const { error } = await supabase.from('customers').update(toRow(parsed.data)).eq('id', id)
  if (error) return { error: friendlyError(error) }
  revalidatePath(`/clientes/${id}`)
  redirect(`/clientes/${id}?ok=guardado`)
}

'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { friendlyError, type ActionState } from '@/lib/errors'
import { localToISO, isValidDate, toLocalTime } from '@/lib/domain/dates'
import { normalizePhone } from '@/lib/domain/phone'
import { uploadImage } from '@/lib/storage'
import type { CompleteAppointmentResult } from '@/lib/types/db'
import { CHANNELS } from '@/lib/domain/labels'

const channelEnum = z.enum(Object.keys(CHANNELS) as [keyof typeof CHANNELS, ...(keyof typeof CHANNELS)[]])

/** Búsqueda por teléfono al agendar: evita duplicar clientas. */
export async function lookupCustomerByPhone(phone: string) {
  const normalized = normalizePhone(phone)
  if (!normalized) return { valid: false as const }
  const supabase = await createClient()
  const { data } = await supabase.rpc('find_customer_by_phone', { p_phone: normalized })
  const found = (data as { id: string; full_name: string; notes: string | null }[] | null)?.[0]
  return { valid: true as const, customer: found ?? null }
}

/** Horarios libres reales (la base decide; nunca se inventan). */
export async function getAvailableTimes(date: string, serviceIds: string[], staffId: string) {
  if (!isValidDate(date) || serviceIds.length === 0 || !staffId) return []
  const supabase = await createClient()
  const { data } = await supabase.rpc('get_available_slots', {
    p_date: date,
    p_service_ids: serviceIds,
    p_staff_id: staffId,
  })
  return ((data ?? []) as { starts_at: string }[]).map((s) => toLocalTime(s.starts_at))
}

const appointmentSchema = z.object({
  staff_id: z.uuid({ error: 'Selecciona la profesional' }),
  date: z.string().refine(isValidDate, 'Selecciona la fecha'),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Selecciona la hora'),
  service_ids: z.array(z.uuid()).min(1, 'Selecciona al menos un servicio'),
  channel: channelEnum.default('presencial'),
  notes: z.string().max(1000).optional(),
  design_notes: z.string().max(1000).optional(),
  allow_outside_hours: z.boolean().default(false),
})

function parseAppointmentForm(formData: FormData) {
  return appointmentSchema.safeParse({
    staff_id: formData.get('staff_id'),
    date: formData.get('date'),
    time: formData.get('time'),
    service_ids: formData.getAll('service_ids'),
    channel: formData.get('channel') || undefined,
    notes: (formData.get('notes') as string) || undefined,
    design_notes: (formData.get('design_notes') as string) || undefined,
    allow_outside_hours: formData.get('allow_outside_hours') === 'on',
  })
}

function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form')
    out[key] ??= issue.message
  }
  return out
}

export async function createAppointment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseAppointmentForm(formData)
  const customerId = (formData.get('customer_id') as string) || null
  const phone = String(formData.get('phone') ?? '').trim()
  const name = String(formData.get('name') ?? '').trim()
  const errors: Record<string, string> = parsed.success ? {} : fieldErrors(parsed.error)
  if (!customerId) {
    if (!phone) errors.phone = 'Escribe el teléfono'
    else if (!normalizePhone(phone)) errors.phone = 'Teléfono inválido'
    if (!name) errors.name = 'Escribe el nombre'
  }
  if (!parsed.success || Object.keys(errors).length) return { fieldErrors: errors, error: 'Revisa los campos marcados.' }

  const upload = await uploadImage('referencias', formData.get('reference') as File | null)
  if (upload.error) return { fieldErrors: { reference: upload.error } }

  const v = parsed.data
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('create_appointment', {
    p_staff_id: v.staff_id,
    p_starts_at: localToISO(v.date, v.time),
    p_service_ids: v.service_ids,
    p_customer_id: customerId,
    p_customer_phone: customerId ? null : phone,
    p_customer_name: customerId ? null : name,
    p_channel: v.channel,
    p_notes: v.notes ?? null,
    p_design_notes: v.design_notes ?? null,
    p_reference_image_path: upload.path,
    p_status: formData.get('confirmed') === 'on' ? 'confirmada' : 'pendiente',
    p_allow_outside_hours: v.allow_outside_hours,
  })
  if (error) return { error: friendlyError(error) }
  revalidatePath('/agenda')
  revalidatePath('/inicio')
  redirect(`/agenda/${data}?ok=creada`)
}

export async function updateAppointment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get('appointment_id') ?? '')
  const parsed = parseAppointmentForm(formData)
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), error: 'Revisa los campos marcados.' }
  const upload = await uploadImage('referencias', formData.get('reference') as File | null)
  if (upload.error) return { fieldErrors: { reference: upload.error } }
  const v = parsed.data
  const supabase = await createClient()
  const { error } = await supabase.rpc('update_appointment', {
    p_appointment_id: id,
    p_staff_id: v.staff_id,
    p_starts_at: localToISO(v.date, v.time),
    p_service_ids: v.service_ids,
    p_channel: v.channel,
    p_notes: v.notes ?? null,
    p_design_notes: v.design_notes ?? null,
    p_reference_image_path: upload.path,
    p_allow_outside_hours: v.allow_outside_hours,
  })
  if (error) return { error: friendlyError(error) }
  revalidatePath('/agenda')
  redirect(`/agenda/${id}?ok=actualizada`)
}

export async function changeAppointmentStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get('appointment_id') ?? '')
  const status = String(formData.get('status') ?? '')
  const reason = String(formData.get('reason') ?? '').trim() || null
  const supabase = await createClient()
  const { error } = await supabase.rpc('set_appointment_status', {
    p_appointment_id: id,
    p_status: status,
    p_reason: reason,
  })
  if (error) return { error: friendlyError(error) }
  revalidatePath('/agenda')
  revalidatePath(`/agenda/${id}`)
  revalidatePath('/inicio')
  return { ok: true }
}

const completeSchema = z.object({
  appointmentId: z.uuid(),
  staffId: z.uuid({ error: 'Selecciona quién atendió' }),
  paymentMethodId: z.uuid({ error: 'Selecciona el medio de pago' }),
  discount: z.number().int().min(0),
  notes: z.string().max(500).optional(),
  items: z
    .array(
      z.object({
        kind: z.enum(['servicio', 'extra']),
        service_id: z.uuid().optional(),
        extra_id: z.uuid().optional(),
        description: z.string().max(120).optional(),
        unit_price: z.number().int().min(0),
        quantity: z.number().int().min(1).default(1),
      }),
    )
    .min(1, 'Agrega al menos un servicio'),
})

export type CompletePayload = z.input<typeof completeSchema>

export async function completeAppointment(payload: CompletePayload): Promise<{ error?: string }> {
  const parsed = completeSchema.safeParse(payload)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  const v = parsed.data
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('complete_appointment', {
    p_appointment_id: v.appointmentId,
    p_items: v.items,
    p_payment_method_id: v.paymentMethodId,
    p_discount: v.discount,
    p_staff_id: v.staffId,
    p_notes: v.notes ?? null,
  })
  if (error) return { error: friendlyError(error) }
  const result = data as CompleteAppointmentResult
  revalidatePath('/agenda')
  revalidatePath('/inicio')
  revalidatePath('/ventas')
  redirect(`/ventas/${result.sale_id}?nueva=1`)
}

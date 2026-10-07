import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { Appointment } from '@/lib/types/db'

export type AppointmentListItem = Appointment & {
  customers: { id: string; full_name: string; phone_e164: string | null } | null
  staff: { id: string; display_name: string; color: string } | null
  appointment_services: { price: number; duration_min: number; sort_order: number; services: { id: string; name: string } | null }[]
}

const LIST_SELECT =
  '*, customers(id, full_name, phone_e164), staff(id, display_name, color), appointment_services(price, duration_min, sort_order, services(id, name))'

export async function listAppointments(opts: {
  fromISO: string
  toISO: string
  staffId?: string | null
  statuses?: string[]
  limit?: number
}): Promise<AppointmentListItem[]> {
  const supabase = await createClient()
  let q = supabase
    .from('appointments')
    .select(LIST_SELECT)
    .gte('starts_at', opts.fromISO)
    .lt('starts_at', opts.toISO)
    .order('starts_at')
    .limit(opts.limit ?? 500)
  if (opts.staffId) q = q.eq('staff_id', opts.staffId)
  if (opts.statuses?.length) q = q.in('status', opts.statuses)
  const { data, error } = await q.returns<AppointmentListItem[]>()
  if (error) throw new Error(error.message)
  return (data ?? []).map(sortServices)
}

export type AppointmentDetail = AppointmentListItem & {
  sales: { id: string; total: number; status: string }[]
}

export async function getAppointment(id: string): Promise<AppointmentDetail | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('appointments')
    .select(`${LIST_SELECT}, sales(id, total, status)`)
    .eq('id', id)
    .maybeSingle<AppointmentDetail>()
  return data ? sortServices(data) : null
}

function sortServices<T extends AppointmentListItem>(a: T): T {
  return { ...a, appointment_services: [...(a.appointment_services ?? [])].sort((x, y) => x.sort_order - y.sort_order) }
}

export function serviceNames(a: AppointmentListItem): string {
  return a.appointment_services.map((s) => s.services?.name).filter(Boolean).join(' + ')
}

export function appointmentTotal(a: AppointmentListItem): number {
  return a.appointment_services.reduce((sum, s) => sum + s.price, 0)
}

export async function signedReferenceUrl(path: string | null): Promise<string | null> {
  if (!path) return null
  const supabase = await createClient()
  const { data } = await supabase.storage.from('referencias').createSignedUrl(path, 60 * 30)
  return data?.signedUrl ?? null
}

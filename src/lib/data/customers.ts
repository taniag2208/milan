import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { Customer, CustomerStats, Sale } from '@/lib/types/db'
import type { Segment } from '@/lib/domain/labels'
import type { AppointmentListItem } from './appointments'

export type CustomerListItem = Customer & { stats: CustomerStats | null; segments: Segment[] }

export async function searchCustomers(opts: { q?: string; segment?: Segment | null; limit?: number }): Promise<CustomerListItem[]> {
  const supabase = await createClient()
  let ids: string[] | null = null
  if (opts.segment) {
    const { data } = await supabase.from('customer_segments').select('customer_id').contains('segments', [opts.segment])
    ids = (data ?? []).map((r: { customer_id: string }) => r.customer_id)
    if (ids.length === 0) return []
  }

  let q = supabase.from('customers').select('*').order('full_name').limit(opts.limit ?? 60)
  const term = opts.q?.trim()
  if (term) {
    const digits = term.replace(/\D/g, '')
    const safe = term.replace(/[%,()]/g, ' ')
    q = digits.length >= 3
      ? q.or(`full_name.ilike.%${safe}%,phone_e164.ilike.%${digits}%`)
      : q.ilike('full_name', `%${safe}%`)
  }
  if (ids) q = q.in('id', ids)
  const { data: customers } = await q.overrideTypes<Customer[], { merge: false }>()
  if (!customers?.length) return []

  const customerIds = customers.map((c) => c.id)
  const [{ data: stats }, { data: segments }] = await Promise.all([
    supabase.from('customer_stats').select('*').in('customer_id', customerIds).overrideTypes<CustomerStats[], { merge: false }>(),
    supabase.from('customer_segments').select('*').in('customer_id', customerIds),
  ])
  return customers.map((c) => ({
    ...c,
    stats: stats?.find((s) => s.customer_id === c.id) ?? null,
    segments: (segments?.find((s: { customer_id: string }) => s.customer_id === c.id)?.segments ?? []) as Segment[],
  }))
}

export type CustomerHistoryItem = Sale & {
  staff: { display_name: string } | null
  sale_items: { description: string; line_total: number; kind: string }[]
  appointments: { notes: string | null; design_notes: string | null } | null
}

export async function getCustomerDetail(id: string, nowISO: string) {
  const supabase = await createClient()
  const [{ data: customer }, { data: stats }, { data: seg }, { data: upcoming }, { data: history }] = await Promise.all([
    supabase.from('customers').select('*').eq('id', id).maybeSingle<Customer>(),
    supabase.from('customer_stats').select('*').eq('customer_id', id).maybeSingle<CustomerStats>(),
    supabase.from('customer_segments').select('segments').eq('customer_id', id).maybeSingle<{ segments: Segment[] }>(),
    supabase
      .from('appointments')
      .select('*, customers(id, full_name, phone_e164), staff(id, display_name, color), appointment_services(price, duration_min, sort_order, services(id, name))')
      .eq('customer_id', id)
      .in('status', ['pendiente', 'confirmada', 'en_servicio'])
      .gte('starts_at', nowISO)
      .order('starts_at')
      .limit(3)
      .overrideTypes<AppointmentListItem[], { merge: false }>(),
    supabase
      .from('sales')
      .select('*, staff(display_name), sale_items(description, line_total, kind), appointments(notes, design_notes)')
      .eq('customer_id', id)
      .eq('status', 'registrada')
      .order('sold_at', { ascending: false })
      .limit(50)
      .overrideTypes<CustomerHistoryItem[], { merge: false }>(),
  ])
  if (!customer) return null
  return { customer, stats, segments: seg?.segments ?? [], upcoming: upcoming ?? [], history: history ?? [] }
}

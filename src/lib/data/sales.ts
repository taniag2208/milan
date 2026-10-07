import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { CommissionRecord, Sale, SaleItem } from '@/lib/types/db'

export type SaleListItem = Sale & {
  customers: { id: string; full_name: string } | null
  staff: { display_name: string } | null
  payment_methods: { name: string } | null
  sale_items: { description: string; kind: string }[]
}

export async function listSales(opts: { fromISO: string; toISO: string; staffId?: string | null; includeVoided?: boolean }) {
  const supabase = await createClient()
  let q = supabase
    .from('sales')
    .select('*, customers(id, full_name), staff(display_name), payment_methods(name), sale_items(description, kind)')
    .gte('sold_at', opts.fromISO)
    .lt('sold_at', opts.toISO)
    .order('sold_at', { ascending: false })
    .limit(500)
  if (opts.staffId) q = q.eq('staff_id', opts.staffId)
  if (!opts.includeVoided) q = q.eq('status', 'registrada')
  const { data, error } = await q.returns<SaleListItem[]>()
  if (error) throw new Error(error.message)
  return data ?? []
}

export type SaleDetail = Sale & {
  customers: { id: string; full_name: string; phone_e164: string | null } | null
  staff: { id: string; display_name: string } | null
  payment_methods: { id: string; name: string } | null
  sale_items: SaleItem[]
  commission_records: Pick<CommissionRecord, 'percent' | 'commission_amount' | 'business_amount' | 'base_amount' | 'status'>[]
}

export async function getSale(id: string): Promise<SaleDetail | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('sales')
    .select('*, customers(id, full_name, phone_e164), staff(id, display_name), payment_methods(id, name), sale_items(*), commission_records(percent, commission_amount, business_amount, base_amount, status)')
    .eq('id', id)
    .maybeSingle<SaleDetail>()
  return data
}

export function summarizeByPayment(sales: SaleListItem[]) {
  const map = new Map<string, { name: string; count: number; total: number }>()
  for (const s of sales) {
    if (s.status !== 'registrada') continue
    const name = s.payment_methods?.name ?? 'Otro'
    const row = map.get(name) ?? { name, count: 0, total: 0 }
    row.count += 1
    row.total += s.total
    map.set(name, row)
  }
  return [...map.values()].sort((a, b) => b.total - a.total)
}

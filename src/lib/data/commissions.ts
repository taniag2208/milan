import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { CommissionSummaryRow } from '@/lib/types/db'

export async function getCommissionSummary(from: string, to: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('commission_summary', { p_from: from, p_to: to })
  if (error) throw new Error(error.message)
  return (data ?? []) as CommissionSummaryRow[]
}

export async function getPendingRecordIds(staffId: string, fromISO: string, toISO: string): Promise<string[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('commission_records')
    .select('id, sales!inner(sold_at)')
    .eq('staff_id', staffId)
    .eq('status', 'pendiente')
    .gte('sales.sold_at', fromISO)
    .lt('sales.sold_at', toISO)
  return (data ?? []).map((r: { id: string }) => r.id)
}

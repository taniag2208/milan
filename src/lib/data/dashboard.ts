import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { DashboardSummary } from '@/lib/types/db'

export async function getDashboard(from: string, to: string): Promise<DashboardSummary> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('dashboard_summary', { p_from: from, p_to: to })
  if (error) throw new Error(error.message)
  return data as DashboardSummary
}

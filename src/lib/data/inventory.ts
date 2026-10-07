import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { InventoryItem, InventoryMovement } from '@/lib/types/db'
import type { StockStatus } from '@/lib/domain/labels'

export async function listInventory(opts: { q?: string; status?: StockStatus | null }) {
  const supabase = await createClient()
  let q = supabase.from('inventory_items').select('*').eq('is_active', true).order('category').order('name')
  if (opts.status) q = q.eq('stock_status', opts.status)
  if (opts.q?.trim()) q = q.ilike('name', `%${opts.q.trim().replace(/[%,()]/g, ' ')}%`)
  const { data } = await q.overrideTypes<InventoryItem[], { merge: false }>()
  return data ?? []
}

export type MovementWithUser = InventoryMovement & { profiles: { full_name: string } | null }

export async function getInventoryItem(id: string) {
  const supabase = await createClient()
  const [{ data: item }, { data: movements }] = await Promise.all([
    supabase.from('inventory_items').select('*').eq('id', id).maybeSingle<InventoryItem>(),
    supabase
      .from('inventory_movements')
      .select('*, profiles(full_name)')
      .eq('item_id', id)
      .order('created_at', { ascending: false })
      .limit(50)
      .overrideTypes<MovementWithUser[], { merge: false }>(),
  ])
  return item ? { item, movements: movements ?? [] } : null
}

export function formatQty(n: number): string {
  return Number.isInteger(Number(n)) ? String(Number(n)) : Number(n).toFixed(2).replace('.', ',')
}

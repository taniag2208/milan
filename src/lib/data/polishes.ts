import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { NailPolish, NailPolishHistory } from '@/lib/types/db'
import type { PolishStatus } from '@/lib/domain/labels'

export async function listPolishes(opts: { q?: string; status?: PolishStatus | 'activos' | null }) {
  const supabase = await createClient()
  let q = supabase.from('nail_polishes').select('*').order('brand').order('color_name').limit(300)
  if (opts.status === 'activos') q = q.in('status', ['activo', 'en_uso'])
  else if (opts.status) q = q.eq('status', opts.status)
  else q = q.neq('status', 'dado_de_baja')
  const term = opts.q?.trim().replace(/[%,()]/g, ' ')
  if (term) q = q.or(`brand.ilike.%${term}%,color_name.ilike.%${term}%,reference.ilike.%${term}%,code.ilike.%${term}%`)
  const { data } = await q.returns<NailPolish[]>()
  return data ?? []
}

export type PolishHistoryItem = NailPolishHistory & { profiles: { full_name: string } | null }

export async function getPolish(id: string) {
  const supabase = await createClient()
  const [{ data: polish }, { data: history }] = await Promise.all([
    supabase.from('nail_polishes').select('*').eq('id', id).maybeSingle<NailPolish>(),
    supabase
      .from('nail_polish_status_history')
      .select('*, profiles(full_name)')
      .eq('polish_id', id)
      .order('changed_at', { ascending: false })
      .returns<PolishHistoryItem[]>(),
  ])
  return polish ? { polish, history: history ?? [] } : null
}

export function polishPhotoUrl(path: string | null): string | null {
  if (!path) return null
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/esmaltes/${path}`
}

import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { AuditLog } from '@/lib/types/db'

export type AuditItem = AuditLog & { actor: { full_name: string } | null }

export async function listAudit(limit = 100) {
  const supabase = await createClient()
  const { data: logs } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
    .overrideTypes<AuditLog[], { merge: false }>()
  const actorIds = [...new Set((logs ?? []).map((l) => l.actor_id).filter(Boolean))] as string[]
  const { data: actors } = actorIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', actorIds)
    : { data: [] as { id: string; full_name: string }[] }
  return (logs ?? []).map((l) => ({
    ...l,
    actor: actors?.find((a: { id: string }) => a.id === l.actor_id) ?? null,
  })) as AuditItem[]
}

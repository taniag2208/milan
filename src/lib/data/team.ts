import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { CommissionRule, Profile, Role, Staff } from '@/lib/types/db'

export type TeamMember = Staff & {
  profile: (Profile & { roles: Pick<Role, 'key' | 'name'> | null }) | null
  percent: number | null
}

export async function listTeam(): Promise<TeamMember[]> {
  const supabase = await createClient()
  const [{ data: staff }, { data: profiles }, { data: rules }] = await Promise.all([
    supabase.from('staff').select('*').order('sort_order').order('display_name').overrideTypes<Staff[], { merge: false }>(),
    supabase.from('profiles').select('*, roles(key, name)').overrideTypes<TeamMember['profile'][], { merge: false }>(),
    supabase.from('commission_rules').select('*').order('effective_from', { ascending: false }).overrideTypes<CommissionRule[], { merge: false }>(),
  ])
  return (staff ?? []).map((s) => ({
    ...s,
    profile: profiles?.find((p) => p?.id === s.profile_id) ?? null,
    percent: rules?.find((r) => r.staff_id === s.id)?.percent ?? null,
  }))
}

/** Usuarios sin ficha de profesional (p. ej. administración). */
export async function listUsersWithoutStaff() {
  const supabase = await createClient()
  const [{ data: profiles }, { data: staff }] = await Promise.all([
    supabase.from('profiles').select('*, roles(key, name)').order('full_name').overrideTypes<NonNullable<TeamMember['profile']>[], { merge: false }>(),
    supabase.from('staff').select('profile_id'),
  ])
  const linked = new Set((staff ?? []).map((s: { profile_id: string | null }) => s.profile_id))
  return (profiles ?? []).filter((p) => !linked.has(p.id))
}

export async function listRoles() {
  const supabase = await createClient()
  const { data } = await supabase.from('roles').select('*').order('is_admin', { ascending: false }).overrideTypes<Role[], { merge: false }>()
  return data ?? []
}

export async function getCommissionHistory(staffId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('commission_rules')
    .select('*')
    .eq('staff_id', staffId)
    .order('effective_from', { ascending: false })
    .overrideTypes<CommissionRule[], { merge: false }>()
  return data ?? []
}

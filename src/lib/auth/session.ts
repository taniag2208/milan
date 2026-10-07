import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type Permission =
  | 'dashboard.view' | 'appointments.read_all' | 'appointments.manage_all' | 'appointments.create'
  | 'customers.read_all' | 'customers.manage' | 'sales.create' | 'sales.read_all' | 'sales.manage'
  | 'commissions.read_all' | 'commissions.manage' | 'inventory.manage' | 'inventory.report'
  | 'polishes.manage' | 'polishes.report' | 'services.manage' | 'users.manage'
  | 'settings.manage' | 'whatsapp.manage' | 'audit.read'

export interface AppSession {
  userId: string
  username: string
  fullName: string
  roleKey: string
  roleName: string
  isAdmin: boolean
  permissions: Permission[]
  staffId: string | null
}

type ProfileRow = {
  id: string
  username: string
  full_name: string
  is_active: boolean
  roles: { key: string; name: string; is_admin: boolean; role_permissions: { permission_key: Permission }[] } | null
}

/** Sesión de la usuaria actual (una consulta por request gracias a cache). */
export const getSession = cache(async (): Promise<AppSession | null> => {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub
  if (!userId) return null

  const [{ data: profile }, { data: staff }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, username, full_name, is_active, roles(key, name, is_admin, role_permissions(permission_key))')
      .eq('id', userId)
      .maybeSingle<ProfileRow>(),
    supabase.from('staff').select('id').eq('profile_id', userId).maybeSingle<{ id: string }>(),
  ])
  if (!profile || !profile.is_active || !profile.roles) return null

  return {
    userId,
    username: profile.username,
    fullName: profile.full_name,
    roleKey: profile.roles.key,
    roleName: profile.roles.name,
    isAdmin: profile.roles.is_admin,
    permissions: profile.roles.role_permissions.map((p) => p.permission_key),
    staffId: staff?.id ?? null,
  }
})

export function can(session: AppSession, permission: Permission): boolean {
  return session.isAdmin || session.permissions.includes(permission)
}

export async function requireSession(): Promise<AppSession> {
  const session = await getSession()
  if (!session) redirect('/login?error=sin-acceso')
  return session
}

export async function requirePermission(...anyOf: Permission[]): Promise<AppSession> {
  const session = await requireSession()
  if (!anyOf.some((p) => can(session, p))) redirect('/inicio')
  return session
}

/** Ventas: administración ve todas; una profesional solo las suyas. Un usuario compartido no las ve. */
export function canViewSales(session: AppSession): boolean {
  return can(session, 'sales.read_all') || (can(session, 'sales.create') && Boolean(session.staffId))
}

/** Comisiones: administración ve todas; una profesional solo las suyas. */
export function canViewCommissions(session: AppSession): boolean {
  return can(session, 'commissions.read_all') || Boolean(session.staffId)
}

/** Montos de dinero de clientas (total gastado, valores del historial). */
export function canViewMoney(session: AppSession): boolean {
  return can(session, 'sales.read_all')
}

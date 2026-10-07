'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient, hasServiceRole } from '@/lib/supabase/admin'
import { can, getSession } from '@/lib/auth/session'
import { friendlyError, type ActionState } from '@/lib/errors'
import { normalizeUsername, usernameToEmail, USERNAME_PATTERN } from '@/lib/auth/username'

async function assertCanManageUsers(): Promise<string | null> {
  const session = await getSession()
  if (!session || !can(session, 'users.manage')) return 'No tienes permiso para administrar usuarios.'
  return null
}

const passwordSchema = z.string().min(8, 'La contraseña debe tener al menos 8 caracteres')

/** Crea el usuario de Auth + perfil. Solo servidor, tras validar permiso. */
async function createLogin(opts: { username: string; password: string; fullName: string; roleKey: string }) {
  if (!hasServiceRole()) return { error: 'Falta configurar SUPABASE_SERVICE_ROLE_KEY en el servidor para crear usuarios.' }
  const username = normalizeUsername(opts.username)
  if (!USERNAME_PATTERN.test(username)) return { error: 'Usuario inválido: usa 3–32 letras, números, punto o guion.' }
  const pw = passwordSchema.safeParse(opts.password)
  if (!pw.success) return { error: pw.error.issues[0].message }

  const admin = createAdminClient()
  const { data: role } = await admin.from('roles').select('id').eq('key', opts.roleKey).single()
  if (!role) return { error: 'Rol inválido' }
  const { data: existing } = await admin.from('profiles').select('id').eq('username', username).maybeSingle()
  if (existing) return { error: 'Ese usuario ya existe.' }

  const { data, error } = await admin.auth.admin.createUser({
    email: usernameToEmail(username),
    password: opts.password,
    email_confirm: true,
    user_metadata: { username, full_name: opts.fullName },
  })
  if (error || !data.user) return { error: error?.message.includes('already') ? 'Ese usuario ya existe.' : 'No se pudo crear el usuario.' }

  const { error: profileError } = await admin.from('profiles').insert({
    id: data.user.id,
    username,
    full_name: opts.fullName,
    role_id: role.id,
  })
  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id)
    return { error: friendlyError(profileError) }
  }
  return { userId: data.user.id }
}

const memberSchema = z.object({
  display_name: z.string().trim().min(2, 'Escribe el nombre'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#BCAA8E'),
  percent: z.number().min(0).max(100).optional(),
  attends: z.boolean(),
})

export async function createMember(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const denied = await assertCanManageUsers()
  if (denied) return { error: denied }
  const parsed = memberSchema.safeParse({
    display_name: fd.get('display_name'),
    color: fd.get('color') || undefined,
    percent: fd.get('percent') ? Number(fd.get('percent')) : undefined,
    attends: fd.get('attends') === 'on',
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message }
  const v = parsed.data
  const withLogin = fd.get('with_login') === 'on'

  let profileId: string | null = null
  if (withLogin) {
    const res = await createLogin({
      username: String(fd.get('username') ?? ''),
      password: String(fd.get('password') ?? ''),
      fullName: v.display_name,
      roleKey: String(fd.get('role_key') ?? 'colaboradora'),
    })
    if ('error' in res) return { error: res.error }
    profileId = res.userId
  }
  if (!v.attends) {
    revalidatePath('/equipo')
    redirect('/equipo?ok=creado')
  }

  const supabase = await createClient()
  const { data: staff, error } = await supabase
    .from('staff')
    .insert({ display_name: v.display_name, color: v.color, profile_id: profileId })
    .select('id')
    .single()
  if (error) return { error: friendlyError(error) }
  if (v.percent !== undefined) {
    const { error: e2 } = await supabase.rpc('set_commission_percent', { p_staff_id: staff.id, p_percent: v.percent })
    if (e2) return { error: friendlyError(e2) }
  }
  revalidatePath('/equipo')
  redirect(`/equipo/${staff.id}?ok=creado`)
}

export async function updateMember(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const denied = await assertCanManageUsers()
  if (denied) return { error: denied }
  const id = String(fd.get('id') ?? '')
  const parsed = memberSchema.safeParse({
    display_name: fd.get('display_name'),
    color: fd.get('color') || undefined,
    percent: fd.get('percent') !== null && fd.get('percent') !== '' ? Number(fd.get('percent')) : undefined,
    attends: true,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message }
  const supabase = await createClient()
  const { error } = await supabase
    .from('staff')
    .update({ display_name: parsed.data.display_name, color: parsed.data.color, is_active: fd.get('is_active') === 'on' })
    .eq('id', id)
  if (error) return { error: friendlyError(error) }

  const previous = Number(fd.get('previous_percent'))
  if (parsed.data.percent !== undefined && parsed.data.percent !== previous) {
    const { error: e2 } = await supabase.rpc('set_commission_percent', { p_staff_id: id, p_percent: parsed.data.percent })
    if (e2) return { error: friendlyError(e2) }
  }
  revalidatePath('/equipo')
  revalidatePath(`/equipo/${id}`)
  return { ok: true, message: 'Cambios guardados' }
}

/** Crea acceso para una profesional que aún no tiene usuario. */
export async function addLoginToStaff(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const denied = await assertCanManageUsers()
  if (denied) return { error: denied }
  const staffId = String(fd.get('staff_id') ?? '')
  const res = await createLogin({
    username: String(fd.get('username') ?? ''),
    password: String(fd.get('password') ?? ''),
    fullName: String(fd.get('full_name') ?? ''),
    roleKey: String(fd.get('role_key') ?? 'colaboradora'),
  })
  if ('error' in res) return { error: res.error }
  const supabase = await createClient()
  const { error } = await supabase.from('staff').update({ profile_id: res.userId }).eq('id', staffId)
  if (error) return { error: friendlyError(error) }
  revalidatePath(`/equipo/${staffId}`)
  return { ok: true, message: 'Usuario creado' }
}

export async function updateAccess(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const denied = await assertCanManageUsers()
  if (denied) return { error: denied }
  const session = await getSession()
  const profileId = String(fd.get('profile_id') ?? '')
  const isActive = fd.get('is_active') === 'on'
  const roleKey = String(fd.get('role_key') ?? '')
  const password = String(fd.get('password') ?? '')
  if (profileId === session?.userId && !isActive) return { error: 'No puedes desactivar tu propio usuario.' }

  const supabase = await createClient()
  const { data: role } = await supabase.from('roles').select('id').eq('key', roleKey).single()
  if (!role) return { error: 'Rol inválido' }
  if (profileId === session?.userId && roleKey !== session.roleKey) return { error: 'No puedes cambiar tu propio rol.' }

  const { error } = await supabase.from('profiles').update({ is_active: isActive, role_id: role.id }).eq('id', profileId)
  if (error) return { error: friendlyError(error) }

  // Contraseña y bloqueo de sesión se manejan en Supabase Auth (solo servidor).
  if (hasServiceRole()) {
    if (password) {
      const pw = passwordSchema.safeParse(password)
      if (!pw.success) return { error: pw.error.issues[0].message }
    }
    const admin = createAdminClient()
    const { error: authError } = await admin.auth.admin.updateUserById(profileId, {
      ...(password ? { password } : {}),
      ban_duration: isActive ? 'none' : '876000h',
    })
    if (authError) return { error: 'No se pudo actualizar el acceso.' }
  } else if (password) {
    return { error: 'Falta SUPABASE_SERVICE_ROLE_KEY para cambiar contraseñas.' }
  }
  revalidatePath('/equipo')
  return { ok: true, message: password ? 'Contraseña y acceso actualizados' : 'Acceso actualizado' }
}

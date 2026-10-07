'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { friendlyError, type ActionState } from '@/lib/errors'

async function saveSetting(key: string, value: unknown): Promise<ActionState> {
  const session = await getSession()
  const supabase = await createClient()
  const { error } = await supabase
    .from('business_settings')
    .upsert({ key, value, updated_by: session?.userId ?? null })
  if (error) return { error: friendlyError(error) }
  revalidatePath('/configuracion')
  return { ok: true, message: 'Configuración guardada' }
}

async function currentSetting(key: string): Promise<Record<string, unknown>> {
  const supabase = await createClient()
  const { data } = await supabase.from('business_settings').select('value').eq('key', key).maybeSingle()
  return (data?.value as Record<string, unknown>) ?? {}
}

const text = (fd: FormData, k: string) => (String(fd.get(k) ?? '').trim() || null)

export async function saveBusiness(_p: ActionState, fd: FormData): Promise<ActionState> {
  const current = await currentSetting('business')
  return saveSetting('business', {
    ...current,
    name: text(fd, 'name') ?? 'MILAN',
    address: text(fd, 'address'),
    phone: text(fd, 'phone'),
    instagram: text(fd, 'instagram'),
  })
}

export async function saveHours(_p: ActionState, fd: FormData): Promise<ActionState> {
  const hours: Record<string, { open: string; close: string } | null> = {}
  for (let d = 1; d <= 7; d++) {
    const open = String(fd.get(`open_${d}`) ?? '')
    const close = String(fd.get(`close_${d}`) ?? '')
    if (fd.get(`enabled_${d}`) !== 'on') {
      hours[d] = null
      continue
    }
    if (!/^\d{2}:\d{2}$/.test(open) || !/^\d{2}:\d{2}$/.test(close) || open >= close) {
      return { error: 'Revisa las horas: la apertura debe ser antes del cierre.' }
    }
    hours[d] = { open, close }
  }
  return saveSetting('opening_hours', hours)
}

export async function saveOperations(_p: ActionState, fd: FormData): Promise<ActionState> {
  const slot = Number(fd.get('slot_minutes'))
  if (![15, 20, 30, 45, 60].includes(slot)) return { error: 'Intervalo inválido' }
  const base = fd.get('commission_base') === 'bruto' ? 'bruto' : 'neto'
  const r1 = await saveSetting('agenda', { ...(await currentSetting('agenda')), slot_minutes: slot })
  if (r1.error) return r1
  const r2 = await saveSetting('commission', { base })
  if (r2.error) return r2

  // Permiso de colaboradoras para crear citas (role_permissions, extensible).
  const supabase = await createClient()
  const { data: role } = await supabase.from('roles').select('id').eq('key', 'colaboradora').single()
  if (role) {
    const allow = fd.get('staff_can_create') === 'on'
    const { error } = allow
      ? await supabase.from('role_permissions').upsert({ role_id: role.id, permission_key: 'appointments.create' })
      : await supabase.from('role_permissions').delete().eq('role_id', role.id).eq('permission_key', 'appointments.create')
    if (error) return { error: friendlyError(error) }
  }
  return { ok: true, message: 'Configuración guardada' }
}

export async function saveCrmRules(_p: ActionState, fd: FormData): Promise<ActionState> {
  const current = await currentSetting('crm_rules')
  const n = (k: string) => {
    const v = Number(fd.get(k))
    return Number.isFinite(v) && v >= 0 ? Math.round(v) : (current[k] as number)
  }
  const reactivation: Record<string, number> = {}
  for (const [k, v] of fd.entries()) {
    if (k.startsWith('react_') && String(v).trim() !== '') reactivation[k.slice(6)] = Math.max(1, Number(v))
  }
  return saveSetting('crm_rules', {
    ...current,
    recurring_min_visits: n('recurring_min_visits'),
    vip_window_days: n('vip_window_days'),
    vip_min_spent: n('vip_min_spent'),
    vip_min_visits: n('vip_min_visits'),
    inactive_days: n('inactive_days'),
    reactivation_default_days: n('reactivation_default_days'),
    reactivation_days: reactivation,
    birthday_window_days: n('birthday_window_days'),
  })
}

export async function savePaymentMethod(_p: ActionState, fd: FormData): Promise<ActionState> {
  const id = text(fd, 'id')
  const name = text(fd, 'name')
  if (!name) return { error: 'Escribe el nombre del medio de pago' }
  const supabase = await createClient()
  const { error } = id
    ? await supabase.from('payment_methods').update({ name, is_active: fd.get('is_active') === 'on' }).eq('id', id)
    : await supabase.from('payment_methods').insert({ name, sort_order: 99 })
  if (error) return { error: friendlyError(error) }
  revalidatePath('/configuracion')
  return { ok: true, message: 'Medio de pago guardado' }
}

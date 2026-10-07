'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { friendlyError, type ActionState } from '@/lib/errors'
import { localDayStartISO, addDays, isValidDate } from '@/lib/domain/dates'
import { getPendingRecordIds } from '@/lib/data/commissions'

export async function voidSale(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get('sale_id') ?? '')
  const reason = String(formData.get('reason') ?? '').trim()
  if (!reason) return { error: 'Escribe el motivo de la anulación.' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('void_sale', { p_sale_id: id, p_reason: reason })
  if (error) return { error: friendlyError(error) }
  revalidatePath(`/ventas/${id}`)
  revalidatePath('/ventas')
  return { ok: true, message: 'Venta anulada' }
}

export async function changeSalePayment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get('sale_id') ?? '')
  const paymentMethodId = String(formData.get('payment_method_id') ?? '')
  const supabase = await createClient()
  const { error } = await supabase.rpc('update_sale_payment_method', { p_sale_id: id, p_payment_method_id: paymentMethodId })
  if (error) return { error: friendlyError(error) }
  revalidatePath(`/ventas/${id}`)
  return { ok: true, message: 'Medio de pago actualizado' }
}

export async function markCommissionsPaid(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const staffId = String(formData.get('staff_id') ?? '')
  const from = String(formData.get('from') ?? '')
  const to = String(formData.get('to') ?? '')
  if (!isValidDate(from) || !isValidDate(to)) return { error: 'Rango inválido' }
  const ids = await getPendingRecordIds(staffId, localDayStartISO(from), localDayStartISO(addDays(to, 1)))
  if (ids.length === 0) return { error: 'No hay comisiones pendientes en este periodo.' }
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('mark_commissions_paid', { p_record_ids: ids })
  if (error) return { error: friendlyError(error) }
  revalidatePath('/comisiones')
  return { ok: true, message: `${data} comisiones marcadas como pagadas` }
}

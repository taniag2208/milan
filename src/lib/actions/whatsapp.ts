'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { can, getSession } from '@/lib/auth/session'
import { friendlyError, type ActionState } from '@/lib/errors'
import { WhatsAppService } from '@/lib/integrations/whatsapp/service'

export async function setConversationMode(_p: ActionState, fd: FormData): Promise<ActionState> {
  const id = String(fd.get('conversation_id') ?? '')
  const mode = String(fd.get('mode') ?? '')
  const supabase = await createClient()
  const { error } = await supabase.rpc('set_conversation_mode', { p_conversation_id: id, p_mode: mode })
  if (error) return { error: friendlyError(error) }
  revalidatePath(`/whatsapp/${id}`)
  revalidatePath('/whatsapp')
  return { ok: true }
}

export async function sendManualReply(_p: ActionState, fd: FormData): Promise<ActionState> {
  const session = await getSession()
  if (!session || !can(session, 'whatsapp.manage')) return { error: 'No tienes permiso para realizar esta acción.' }
  const id = String(fd.get('conversation_id') ?? '')
  const text = String(fd.get('text') ?? '').trim()
  if (!text) return { error: 'Escribe un mensaje.' }
  const supabase = await createClient()
  const { data: conv } = await supabase.from('whatsapp_conversations').select('mode').eq('id', id).maybeSingle()
  if (conv?.mode !== 'HUMAN_ACTIVE') return { error: 'Primero toma la conversación.' }
  try {
    await new WhatsAppService().sendMessage(id, text, { sender: 'human', sentBy: session.userId })
  } catch (e) {
    revalidatePath(`/whatsapp/${id}`)
    return { error: e instanceof Error ? e.message : 'No se pudo enviar.' }
  }
  revalidatePath(`/whatsapp/${id}`)
  return { ok: true, message: 'Enviado' }
}

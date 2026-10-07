import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { WhatsappContact, WhatsappConversation, WhatsappMessage } from '@/lib/types/db'

export type ConversationListItem = WhatsappConversation & {
  whatsapp_contacts: (WhatsappContact & { customers: { id: string; full_name: string } | null }) | null
}

export async function listConversations(includeClosed = false) {
  const supabase = await createClient()
  let q = supabase
    .from('whatsapp_conversations')
    .select('*, whatsapp_contacts(*, customers(id, full_name))')
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(100)
  if (!includeClosed) q = q.neq('mode', 'CLOSED')
  const { data } = await q.overrideTypes<ConversationListItem[], { merge: false }>()
  return data ?? []
}

export async function getConversation(id: string) {
  const supabase = await createClient()
  const [{ data: conversation }, { data: messages }] = await Promise.all([
    supabase
      .from('whatsapp_conversations')
      .select('*, whatsapp_contacts(*, customers(id, full_name))')
      .eq('id', id)
      .maybeSingle<ConversationListItem>(),
    supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at')
      .limit(300)
      .overrideTypes<WhatsappMessage[], { merge: false }>(),
  ])
  return conversation ? { conversation, messages: messages ?? [] } : null
}

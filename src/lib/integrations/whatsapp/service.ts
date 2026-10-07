import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizePhone } from '@/lib/domain/phone'
import type { WhatsappConversation, WhatsappMessage } from '@/lib/types/db'
import { canSend } from './config'
import { sendTemplateApi, sendTextApi, WhatsAppApiError } from './client'
import { parseWebhook, shouldUpdateStatus } from './parse'
import type { ParsedInbound, WebhookPayload } from './types'
import { getAgent } from './agent/agent'

/**
 * Servicio de WhatsApp (Meta Cloud API oficial). Corre solo en servidor con
 * service-role. Toda la persistencia es idempotente por wa_message_id.
 */
export class WhatsAppService {
  private db = createAdminClient()

  /** Procesa un webhook completo: mensajes entrantes y estados de entrega. */
  async handleWebhook(payload: WebhookPayload) {
    const { messages, statuses } = parseWebhook(payload)
    for (const m of messages) await this.receiveMessage(m)
    for (const s of statuses) {
      const { data: msg } = await this.db
        .from('whatsapp_messages')
        .select('id, status')
        .eq('wa_message_id', s.waMessageId)
        .maybeSingle<Pick<WhatsappMessage, 'id' | 'status'>>()
      if (msg && shouldUpdateStatus(msg.status, s.status)) {
        await this.db.from('whatsapp_messages').update({ status: s.status, error: s.errors }).eq('id', msg.id)
      }
    }
    return { messages: messages.length, statuses: statuses.length }
  }

  /** Guarda un mensaje entrante (contacto ↔ clienta por teléfono, conversación abierta). */
  async receiveMessage(m: ParsedInbound) {
    const phone = normalizePhone(`+${m.waId}`) ?? `+${m.waId}`
    const { data: customer } = await this.db.from('customers').select('id').eq('phone_e164', phone).maybeSingle()

    const { data: contact, error: contactError } = await this.db
      .from('whatsapp_contacts')
      .upsert(
        { wa_id: m.waId, phone_e164: phone, profile_name: m.profileName, ...(customer ? { customer_id: customer.id } : {}) },
        { onConflict: 'wa_id' },
      )
      .select('id')
      .single()
    if (contactError) throw contactError

    const conversation = await this.openConversation(contact.id)

    const { data: inserted, error } = await this.db
      .from('whatsapp_messages')
      .upsert(
        {
          conversation_id: conversation.id,
          wa_message_id: m.waMessageId,
          direction: 'inbound',
          sender: 'customer',
          message_type: m.type,
          body: m.body,
          payload: m.raw,
          status: 'received',
          wa_timestamp: m.timestamp.toISOString(),
        },
        { onConflict: 'wa_message_id', ignoreDuplicates: true },
      )
      .select('id')
    if (error) throw error
    const isNew = (inserted ?? []).length > 0
    if (!isNew) return { duplicate: true }

    await this.db.from('whatsapp_conversations').update({ last_message_at: m.timestamp.toISOString() }).eq('id', conversation.id)

    // El agente solo actúa en conversaciones AI_ACTIVE. Con HUMAN_ACTIVE nunca responde.
    if (conversation.mode === 'AI_ACTIVE') {
      await getAgent().onInboundMessage({ conversationId: conversation.id, customerId: customer?.id ?? null, phone, message: m }, this)
    }
    return { duplicate: false, conversationId: conversation.id }
  }

  private async openConversation(contactId: string): Promise<WhatsappConversation> {
    const { data: open } = await this.db
      .from('whatsapp_conversations')
      .select('*')
      .eq('contact_id', contactId)
      .neq('mode', 'CLOSED')
      .maybeSingle<WhatsappConversation>()
    if (open) return open
    const { data, error } = await this.db
      .from('whatsapp_conversations')
      .insert({ contact_id: contactId, mode: 'AI_ACTIVE' })
      .select('*')
      .single<WhatsappConversation>()
    if (error) {
      // Carrera: otra petición creó la conversación al mismo tiempo.
      const { data: retry } = await this.db
        .from('whatsapp_conversations').select('*').eq('contact_id', contactId).neq('mode', 'CLOSED')
        .single<WhatsappConversation>()
      if (retry) return retry
      throw error
    }
    return data
  }

  async getConversation(conversationId: string) {
    const { data } = await this.db
      .from('whatsapp_conversations')
      .select('*, whatsapp_contacts(*), whatsapp_messages(*)')
      .eq('id', conversationId)
      .order('created_at', { referencedTable: 'whatsapp_messages' })
      .maybeSingle()
    return data
  }

  /** Envía texto. Si lo envía el agente y la conversación no está AI_ACTIVE, se bloquea. */
  async sendMessage(conversationId: string, text: string, opts: { sender: 'agent' | 'human'; sentBy?: string | null }) {
    const { data: conv } = await this.db
      .from('whatsapp_conversations')
      .select('id, mode, whatsapp_contacts(wa_id)')
      .eq('id', conversationId)
      .single<{ id: string; mode: string; whatsapp_contacts: { wa_id: string } | null }>()
    if (!conv?.whatsapp_contacts) throw new Error('Conversación no encontrada')
    if (opts.sender === 'agent' && conv.mode !== 'AI_ACTIVE') {
      throw new Error('La conversación está en manos de una persona: el agente no responde.')
    }
    return this.deliver(conversationId, () => sendTextApi(conv.whatsapp_contacts!.wa_id, text), {
      sender: opts.sender, sentBy: opts.sentBy ?? null, type: 'text', body: text,
    })
  }

  async sendTemplate(conversationId: string, templateName: string, languageCode = 'es', components: unknown[] = []) {
    const { data: conv } = await this.db
      .from('whatsapp_conversations')
      .select('id, whatsapp_contacts(wa_id)')
      .eq('id', conversationId)
      .single<{ id: string; whatsapp_contacts: { wa_id: string } | null }>()
    if (!conv?.whatsapp_contacts) throw new Error('Conversación no encontrada')
    return this.deliver(conversationId, () => sendTemplateApi(conv.whatsapp_contacts!.wa_id, templateName, languageCode, components), {
      sender: 'system', sentBy: null, type: 'template', body: `[Plantilla] ${templateName}`,
    })
  }

  /** Pasa la conversación a una persona: el agente deja de responder. */
  async handoffToHuman(conversationId: string, reason: string) {
    await this.db.rpc('set_conversation_mode', { p_conversation_id: conversationId, p_mode: 'HUMAN_ACTIVE' })
    await this.db.from('whatsapp_messages').insert({
      conversation_id: conversationId, direction: 'outbound', sender: 'system', message_type: 'note',
      body: `Escalada a humano: ${reason}`, status: 'sent',
    })
  }

  private async deliver(
    conversationId: string,
    send: () => Promise<{ messageId: string }>,
    meta: { sender: 'agent' | 'human' | 'system'; sentBy: string | null; type: string; body: string },
  ) {
    const { data: row, error } = await this.db
      .from('whatsapp_messages')
      .insert({
        conversation_id: conversationId, direction: 'outbound', sender: meta.sender, message_type: meta.type,
        body: meta.body, status: 'queued', sent_by: meta.sentBy,
      })
      .select('id')
      .single()
    if (error) throw error
    if (!canSend()) {
      await this.db.from('whatsapp_messages').update({ status: 'failed', error: { message: 'WhatsApp no configurado' } }).eq('id', row.id)
      throw new Error('WhatsApp no está configurado todavía.')
    }
    try {
      const { messageId } = await send()
      await this.db.from('whatsapp_messages').update({ status: 'sent', wa_message_id: messageId }).eq('id', row.id)
      await this.db.from('whatsapp_conversations').update({ last_message_at: new Date().toISOString() }).eq('id', conversationId)
      return { id: row.id, waMessageId: messageId }
    } catch (e) {
      const details = e instanceof WhatsAppApiError ? e.details : { message: String(e) }
      await this.db.from('whatsapp_messages').update({ status: 'failed', error: details }).eq('id', row.id)
      throw e
    }
  }
}

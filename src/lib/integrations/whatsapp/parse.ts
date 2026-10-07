import type { ParsedInbound, ParsedStatus, WebhookPayload } from './types'

/** Extrae mensajes entrantes y estados de un webhook (función pura, testeable). */
export function parseWebhook(payload: WebhookPayload): { messages: ParsedInbound[]; statuses: ParsedStatus[] } {
  const messages: ParsedInbound[] = []
  const statuses: ParsedStatus[] = []
  if (payload?.object !== 'whatsapp_business_account') return { messages, statuses }

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'messages') continue
      const value = change.value ?? {}
      const names = new Map((value.contacts ?? []).map((c) => [c.wa_id, c.profile?.name ?? null]))
      for (const m of value.messages ?? []) {
        messages.push({
          waMessageId: m.id,
          waId: m.from,
          profileName: names.get(m.from) ?? null,
          type: m.type,
          body: messageText(m),
          timestamp: new Date(Number(m.timestamp) * 1000),
          raw: m,
        })
      }
      for (const s of value.statuses ?? []) {
        statuses.push({
          waMessageId: s.id,
          status: s.status,
          timestamp: new Date(Number(s.timestamp) * 1000),
          errors: s.errors ?? null,
        })
      }
    }
  }
  return { messages, statuses }
}

function messageText(m: ParsedInbound['raw']): string | null {
  switch (m.type) {
    case 'text':
      return m.text?.body ?? null
    case 'image':
      return m.image?.caption ?? '[Imagen]'
    case 'button':
      return m.button?.text ?? null
    case 'interactive':
      return m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? null
    default:
      return `[${m.type}]`
  }
}

/** Solo avanza el estado (sent → delivered → read); "failed" siempre se registra. */
const ORDER = { received: 0, queued: 0, sent: 1, delivered: 2, read: 3, failed: 4 } as const
export function shouldUpdateStatus(current: keyof typeof ORDER, next: keyof typeof ORDER): boolean {
  if (next === 'failed') return current !== 'failed'
  return ORDER[next] > ORDER[current]
}

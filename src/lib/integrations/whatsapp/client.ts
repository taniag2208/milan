import 'server-only'
import { whatsappConfig } from './config'

export class WhatsAppApiError extends Error {
  constructor(message: string, readonly details: unknown) {
    super(message)
  }
}

/** Llamadas a Graph API (oficial). Nunca se llama si no hay token configurado. */
async function post(body: Record<string, unknown>): Promise<{ messageId: string }> {
  const c = whatsappConfig()
  if (!c.phoneNumberId || !c.accessToken) throw new WhatsAppApiError('WhatsApp no está configurado', null)
  const res = await fetch(`https://graph.facebook.com/${c.graphVersion}/${c.phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${c.accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', ...body }),
  })
  const json = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: unknown }
  if (!res.ok || !json.messages?.[0]?.id) throw new WhatsAppApiError('Error enviando mensaje de WhatsApp', json.error ?? json)
  return { messageId: json.messages[0].id }
}

export function sendTextApi(to: string, text: string) {
  return post({ to, type: 'text', text: { body: text, preview_url: false } })
}

export function sendTemplateApi(to: string, templateName: string, languageCode = 'es', components: unknown[] = []) {
  return post({ to, type: 'template', template: { name: templateName, language: { code: languageCode }, components } })
}

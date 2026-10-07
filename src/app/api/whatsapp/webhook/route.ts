import { NextResponse, type NextRequest } from 'next/server'
import { whatsappConfig } from '@/lib/integrations/whatsapp/config'
import { verifySignature } from '@/lib/integrations/whatsapp/signature'
import { WhatsAppService } from '@/lib/integrations/whatsapp/service'
import { createAdminClient, hasServiceRole } from '@/lib/supabase/admin'
import type { WebhookPayload } from '@/lib/integrations/whatsapp/types'

export const dynamic = 'force-dynamic'

/** Verificación del webhook (Meta envía hub.mode, hub.verify_token, hub.challenge). */
export async function GET(request: NextRequest) {
  const { verifyToken } = whatsappConfig()
  const params = request.nextUrl.searchParams
  if (verifyToken && params.get('hub.mode') === 'subscribe' && params.get('hub.verify_token') === verifyToken) {
    return new NextResponse(params.get('hub.challenge') ?? '', { status: 200 })
  }
  return new NextResponse('Forbidden', { status: 403 })
}

/** Recepción de eventos: firma → log crudo → procesamiento idempotente. */
export async function POST(request: NextRequest) {
  const { appSecret } = whatsappConfig()
  if (!appSecret || !hasServiceRole()) {
    return NextResponse.json({ error: 'WhatsApp no configurado' }, { status: 503 })
  }
  const raw = await request.text()
  const valid = verifySignature(raw, request.headers.get('x-hub-signature-256'), appSecret)

  let payload: WebhookPayload
  try {
    payload = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const db = createAdminClient()
  const { data: event } = await db
    .from('whatsapp_webhook_events')
    .insert({ signature_valid: valid, payload: valid ? payload : { rejected: true } })
    .select('id')
    .single()

  if (!valid) return NextResponse.json({ error: 'Firma inválida' }, { status: 401 })

  try {
    await new WhatsAppService().handleWebhook(payload)
    if (event) await db.from('whatsapp_webhook_events').update({ processed_at: new Date().toISOString() }).eq('id', event.id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[whatsapp-webhook]', message)
    if (event) await db.from('whatsapp_webhook_events').update({ error: message }).eq('id', event.id)
    // 500 → Meta reintenta; la persistencia es idempotente por wa_message_id.
    return NextResponse.json({ error: 'Error procesando el evento' }, { status: 500 })
  }
}

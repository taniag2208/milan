import { describe, expect, it } from 'vitest'
import { createHmac } from 'node:crypto'
import { verifySignature } from './signature'
import { parseWebhook, shouldUpdateStatus } from './parse'

describe('verifySignature', () => {
  const secret = 'secreto-de-prueba'
  const body = '{"object":"whatsapp_business_account"}'
  const good = 'sha256=' + createHmac('sha256', secret).update(body).digest('hex')
  it('acepta firmas válidas', () => expect(verifySignature(body, good, secret)).toBe(true))
  it('rechaza firmas inválidas o ausentes', () => {
    expect(verifySignature(body + ' ', good, secret)).toBe(false)
    expect(verifySignature(body, null, secret)).toBe(false)
    expect(verifySignature(body, good, '')).toBe(false)
    expect(verifySignature(body, 'sha256=abc', secret)).toBe(false)
  })
})

describe('parseWebhook', () => {
  it('extrae mensajes y estados', () => {
    const r = parseWebhook({
      object: 'whatsapp_business_account',
      entry: [{
        id: '1',
        changes: [{
          field: 'messages',
          value: {
            contacts: [{ wa_id: '573001234567', profile: { name: 'Ana' } }],
            messages: [{ id: 'wamid.1', from: '573001234567', timestamp: '1700000000', type: 'text', text: { body: 'Hola' } }],
            statuses: [{ id: 'wamid.0', status: 'read', timestamp: '1700000001', recipient_id: '573001234567' }],
          },
        }],
      }],
    })
    expect(r.messages[0]).toMatchObject({ waMessageId: 'wamid.1', waId: '573001234567', profileName: 'Ana', body: 'Hola' })
    expect(r.statuses[0]).toMatchObject({ waMessageId: 'wamid.0', status: 'read' })
  })
  it('ignora otros objetos', () => {
    expect(parseWebhook({ object: 'page' }).messages).toHaveLength(0)
  })
  it('los estados solo avanzan', () => {
    expect(shouldUpdateStatus('sent', 'delivered')).toBe(true)
    expect(shouldUpdateStatus('read', 'delivered')).toBe(false)
    expect(shouldUpdateStatus('delivered', 'failed')).toBe(true)
  })
})

import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Verifica X-Hub-Signature-256 (HMAC-SHA256 del cuerpo crudo con META_APP_SECRET).
 * Usa comparación en tiempo constante.
 */
export function verifySignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header || !appSecret || !header.startsWith('sha256=')) return false
  const expected = createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex')
  const received = header.slice('sha256='.length)
  if (received.length !== expected.length) return false
  try {
    return timingSafeEqual(Buffer.from(received, 'hex'), Buffer.from(expected, 'hex'))
  } catch {
    return false
  }
}

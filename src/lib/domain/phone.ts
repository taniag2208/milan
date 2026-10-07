/**
 * Normaliza teléfonos a E.164 asumiendo Colombia (+57). Debe coincidir con
 * public.normalize_phone en la base de datos.
 */
export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null
  const trimmed = input.trim()
  const hasPlus = trimmed.startsWith('+') || trimmed.startsWith('00')
  let digits = trimmed.replace(/\D/g, '')
  if (trimmed.startsWith('00')) digits = digits.slice(2)
  if (digits.length < 7) return null
  if (!hasPlus) {
    if (digits.length === 10) return `+57${digits}`
    if (digits.length === 12 && digits.startsWith('57')) return `+${digits}`
    if (digits.length <= 10) return `+57${digits}`
  }
  return `+${digits}`
}

/** "+573001234567" → "300 123 4567" para mostrar. */
export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return ''
  if (e164.startsWith('+57') && e164.length === 13) {
    const n = e164.slice(3)
    return `${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`
  }
  return e164
}

/** Enlace oficial wa.me (abre WhatsApp en el teléfono; no automatiza nada). */
export function whatsappLink(e164: string, text?: string): string {
  const base = `https://wa.me/${e164.replace(/\D/g, '')}`
  return text ? `${base}?text=${encodeURIComponent(text)}` : base
}

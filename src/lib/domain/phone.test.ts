import { describe, expect, it } from 'vitest'
import { formatPhone, normalizePhone, whatsappLink } from './phone'

describe('normalizePhone', () => {
  it('normaliza celulares colombianos en cualquier formato', () => {
    for (const input of ['3001234567', '300 123 4567', '300-123-4567', '+57 300 123 4567', '573001234567', '0057 3001234567']) {
      expect(normalizePhone(input)).toBe('+573001234567')
    }
  })
  it('respeta indicativos internacionales', () => {
    expect(normalizePhone('+1 (305) 555-1234')).toBe('+13055551234')
  })
  it('rechaza valores que no son teléfonos', () => {
    expect(normalizePhone('123')).toBeNull()
    expect(normalizePhone('')).toBeNull()
    expect(normalizePhone(null)).toBeNull()
  })
})

describe('formatPhone / whatsappLink', () => {
  it('formatea para mostrar', () => {
    expect(formatPhone('+573001234567')).toBe('300 123 4567')
  })
  it('genera enlace wa.me', () => {
    expect(whatsappLink('+573001234567', 'Hola')).toBe('https://wa.me/573001234567?text=Hola')
  })
})

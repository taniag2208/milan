import { describe, expect, it } from 'vitest'
import { formatCOP, parseCOP } from './money'

describe('formatCOP', () => {
  it('usa punto como separador de miles', () => {
    expect(formatCOP(45000)).toBe('$45.000')
    expect(formatCOP(1250000)).toBe('$1.250.000')
    expect(formatCOP(500)).toBe('$500')
    expect(formatCOP(0)).toBe('$0')
  })
  it('maneja negativos y nulos', () => {
    expect(formatCOP(-5000)).toBe('-$5.000')
    expect(formatCOP(null)).toBe('$0')
  })
})

describe('parseCOP', () => {
  it('acepta formatos comunes', () => {
    expect(parseCOP('45.000')).toBe(45000)
    expect(parseCOP('$45,000')).toBe(45000)
    expect(parseCOP(' 45 000 ')).toBe(45000)
    expect(parseCOP('')).toBeNull()
    expect(parseCOP(12.6)).toBe(13)
  })
})

import { describe, expect, it } from 'vitest'
import { computeSale } from './commission'

describe('computeSale (debe coincidir con complete_appointment)', () => {
  it('60% sobre neto con descuento proporcional', () => {
    const r = computeSale(
      [{ unitPrice: 45000, commissionable: true }, { unitPrice: 5000, commissionable: true }],
      5000, 60,
    )
    expect(r).toMatchObject({ gross: 50000, total: 45000, base: 45000, commission: 27000, business: 18000 })
  })
  it('modo bruto ignora el descuento para la base', () => {
    const r = computeSale([{ unitPrice: 50000, commissionable: true }], 10000, 40, 'bruto')
    expect(r).toMatchObject({ total: 40000, base: 50000, commission: 20000 })
  })
  it('ítems no comisionables no suman a la base', () => {
    const r = computeSale(
      [{ unitPrice: 90000, commissionable: true }, { unitPrice: 10000, quantity: 2, commissionable: false }],
      0, 50,
    )
    expect(r).toMatchObject({ total: 110000, base: 90000, commission: 45000 })
  })
  it('el descuento nunca supera el total', () => {
    expect(computeSale([{ unitPrice: 10000, commissionable: true }], 20000, 50).total).toBe(0)
  })
})

/**
 * Vista previa del cálculo de venta/comisión en la pantalla de cierre.
 * La fuente de verdad es public.complete_appointment (servidor); esta función
 * replica la misma regla para mostrar el valor antes de confirmar.
 */
export type SaleLine = { unitPrice: number; quantity?: number; commissionable: boolean }

export type CommissionBase = 'neto' | 'bruto'

export function computeSale(
  lines: SaleLine[],
  discount: number,
  percent: number,
  baseMode: CommissionBase = 'neto',
) {
  const gross = lines.reduce((sum, l) => sum + l.unitPrice * (l.quantity ?? 1), 0)
  const commissionableGross = lines
    .filter((l) => l.commissionable)
    .reduce((sum, l) => sum + l.unitPrice * (l.quantity ?? 1), 0)
  const safeDiscount = Math.min(Math.max(0, discount), gross)
  const total = gross - safeDiscount
  const base =
    baseMode === 'bruto' || gross === 0
      ? commissionableGross
      : commissionableGross - Math.round((safeDiscount * commissionableGross) / gross)
  const commission = Math.round((base * percent) / 100)
  return { gross, discount: safeDiscount, total, base, commission, business: total - commission }
}

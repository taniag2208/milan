/** Formatea pesos colombianos como "$45.000" (sin decimales, punto de miles). */
export function formatCOP(value: number | null | undefined): string {
  const n = Math.round(Number(value ?? 0))
  const sign = n < 0 ? '-' : ''
  const digits = Math.abs(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${sign}$${digits}`
}

/** Convierte lo que escribe la usuaria ("45.000", "$45000", "45 000") a entero. */
export function parseCOP(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null
  if (typeof input === 'number') return Number.isFinite(input) ? Math.round(input) : null
  const digits = input.replace(/[^\d]/g, '')
  if (digits === '') return null
  return Number.parseInt(digits, 10)
}

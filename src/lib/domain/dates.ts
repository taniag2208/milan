/**
 * Fechas en la zona del negocio (America/Bogota, UTC-5 sin horario de verano).
 * Las fechas "locales" se manejan como strings YYYY-MM-DD y horas HH:mm.
 */
export const BUSINESS_TZ = 'America/Bogota'
const OFFSET = '-05:00'

const dateFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
const timeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: BUSINESS_TZ,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** Fecha local YYYY-MM-DD de un instante. */
export function toLocalDate(instant: Date | string = new Date()): string {
  return dateFmt.format(new Date(instant))
}

/** Hora local HH:mm de un instante. */
export function toLocalTime(instant: Date | string): string {
  return timeFmt.format(new Date(instant))
}

export function todayLocal(): string {
  return toLocalDate(new Date())
}

/** Fecha + hora locales → ISO con offset de Bogotá. */
export function localToISO(date: string, time: string): string {
  return new Date(`${date}T${time.length === 5 ? `${time}:00` : time}${OFFSET}`).toISOString()
}

/** Inicio del día local como ISO (para filtros >=). */
export function localDayStartISO(date: string): string {
  return localToISO(date, '00:00')
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Día ISO de la semana: 1 = lunes … 7 = domingo. */
export function isoWeekday(date: string): number {
  const d = new Date(`${date}T12:00:00Z`).getUTCDay()
  return d === 0 ? 7 : d
}

export function startOfWeek(date: string): string {
  return addDays(date, 1 - isoWeekday(date))
}

export function startOfMonth(date: string): string {
  return `${date.slice(0, 7)}-01`
}

export function endOfMonth(date: string): string {
  const [y, m] = date.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return `${date.slice(0, 7)}-${String(last).padStart(2, '0')}`
}

/** Quincena actual: 1–15 o 16–fin de mes. */
export function fortnightRange(date: string): { from: string; to: string } {
  const day = Number(date.slice(8, 10))
  return day <= 15
    ? { from: startOfMonth(date), to: `${date.slice(0, 7)}-15` }
    : { from: `${date.slice(0, 7)}-16`, to: endOfMonth(date) }
}

export type RangeKey = 'hoy' | 'semana' | 'quincena' | 'mes' | 'personalizado'

export function resolveRange(
  key: RangeKey,
  today: string,
  custom?: { from?: string; to?: string },
): { from: string; to: string } {
  switch (key) {
    case 'semana':
      return { from: startOfWeek(today), to: addDays(startOfWeek(today), 6) }
    case 'quincena':
      return fortnightRange(today)
    case 'mes':
      return { from: startOfMonth(today), to: endOfMonth(today) }
    case 'personalizado': {
      const from = isValidDate(custom?.from) ? custom!.from! : today
      const to = isValidDate(custom?.to) ? custom!.to! : from
      return from <= to ? { from, to } : { from: to, to: from }
    }
    default:
      return { from: today, to: today }
  }
}

export function isValidDate(value: string | undefined | null): boolean {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`))
}

const WEEKDAYS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
const WEEKDAYS_SHORT = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export function weekdayName(date: string, short = false): string {
  return (short ? WEEKDAYS_SHORT : WEEKDAYS)[isoWeekday(date) - 1]
}

/** "martes 7 de octubre" */
export function formatLongDate(date: string): string {
  const [, m, d] = date.split('-').map(Number)
  return `${weekdayName(date)} ${d} de ${MONTHS[m - 1]}`
}

/** "7 oct 2026" */
export function formatShortDate(date: string, withYear = true): string {
  const [y, m, d] = date.split('-').map(Number)
  return `${d} ${MONTHS[m - 1].slice(0, 3)}${withYear ? ` ${y}` : ''}`
}

/** "2:30 p. m." a partir de un instante. */
export function formatTime(instant: Date | string): string {
  const [h, min] = toLocalTime(instant).split(':').map(Number)
  const suffix = h >= 12 ? 'p. m.' : 'a. m.'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(min).padStart(2, '0')} ${suffix}`
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

import { describe, expect, it } from 'vitest'
import {
  addDays, formatLongDate, formatTime, fortnightRange, isoWeekday, localToISO,
  resolveRange, startOfWeek, toLocalDate, toLocalTime,
} from './dates'

describe('zona horaria Bogotá', () => {
  it('una venta a las 7:30 p. m. sigue siendo del mismo día local', () => {
    const iso = localToISO('2026-10-07', '19:30')
    expect(iso).toBe('2026-10-08T00:30:00.000Z')
    expect(toLocalDate(iso)).toBe('2026-10-07')
    expect(toLocalTime(iso)).toBe('19:30')
    expect(formatTime(iso)).toBe('7:30 p. m.')
  })
})

describe('calendario', () => {
  it('días de la semana ISO', () => {
    expect(isoWeekday('2026-10-05')).toBe(1) // lunes
    expect(isoWeekday('2026-10-11')).toBe(7) // domingo
    expect(startOfWeek('2026-10-07')).toBe('2026-10-05')
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
  })
  it('quincenas', () => {
    expect(fortnightRange('2026-10-07')).toEqual({ from: '2026-10-01', to: '2026-10-15' })
    expect(fortnightRange('2026-02-20')).toEqual({ from: '2026-02-16', to: '2026-02-28' })
  })
  it('rangos', () => {
    expect(resolveRange('mes', '2026-10-07')).toEqual({ from: '2026-10-01', to: '2026-10-31' })
    expect(resolveRange('personalizado', '2026-10-07', { from: '2026-10-10', to: '2026-10-01' }))
      .toEqual({ from: '2026-10-01', to: '2026-10-10' })
  })
  it('formato largo en español', () => {
    expect(formatLongDate('2026-10-07')).toBe('miércoles 7 de octubre')
  })
})

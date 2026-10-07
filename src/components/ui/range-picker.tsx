import { Segmented } from './segmented'
import type { RangeKey } from '@/lib/domain/dates'

const LABELS: Record<RangeKey, string> = {
  hoy: 'Hoy',
  semana: 'Semana',
  quincena: 'Quincena',
  mes: 'Mes',
  personalizado: 'Rango',
}

/** Selector de periodo (estado en la URL) con rango personalizado. */
export function RangePicker({
  basePath,
  active,
  keys,
  from,
  to,
}: {
  basePath: string
  active: RangeKey
  keys: RangeKey[]
  from: string
  to: string
}) {
  return (
    <div className="space-y-2">
      <Segmented
        active={active}
        items={keys.map((k) => ({
          key: k,
          label: LABELS[k],
          href: k === 'hoy' ? basePath : `${basePath}?rango=${k}${k === 'personalizado' ? `&desde=${from}&hasta=${to}` : ''}`,
        }))}
      />
      {active === 'personalizado' && (
        <form method="get" action={basePath} className="flex items-end gap-2">
          <input type="hidden" name="rango" value="personalizado" />
          <label className="flex-1 text-xs text-ink-muted">
            Desde
            <input type="date" name="desde" defaultValue={from} className="mt-1 block h-11 w-full rounded-xl border border-line bg-card px-3 text-sm text-ink" />
          </label>
          <label className="flex-1 text-xs text-ink-muted">
            Hasta
            <input type="date" name="hasta" defaultValue={to} className="mt-1 block h-11 w-full rounded-xl border border-line bg-card px-3 text-sm text-ink" />
          </label>
          <button className="h-11 rounded-xl bg-ink px-4 text-sm text-cream">Ver</button>
        </form>
      )}
    </div>
  )
}

export function parseRangeKey(value: unknown, allowed: RangeKey[]): RangeKey {
  return allowed.includes(value as RangeKey) ? (value as RangeKey) : 'hoy'
}

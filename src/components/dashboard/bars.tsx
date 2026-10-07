import { formatCOP } from '@/lib/domain/money'

/** Barras horizontales simples: legibles en celular, sin librerías de gráficos. */
export function Bars({ rows, empty = 'Sin datos en este periodo' }: {
  rows: { name: string; total: number; count?: number }[]
  empty?: string
}) {
  if (rows.length === 0) return <p className="text-sm text-ink-muted">{empty}</p>
  const max = Math.max(...rows.map((r) => r.total), 1)
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.name}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate text-ink">
              {r.name}
              {r.count !== undefined && <span className="text-ink-muted"> · {r.count}</span>}
            </span>
            <span className="tabular shrink-0 font-medium">{formatCOP(r.total)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-cream">
            <div className="h-1.5 rounded-full bg-almond" style={{ width: `${Math.max(4, (r.total / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

export function MiniStat({ label, value, tone }: { label: string; value: number | string; tone?: 'muted' | 'danger' | 'success' }) {
  return (
    <div className="rounded-2xl bg-cream/60 px-3 py-2.5 text-center">
      <p className={`font-display text-2xl tabular ${tone === 'danger' ? 'text-danger' : tone === 'success' ? 'text-success' : 'text-ink'}`}>{value}</p>
      <p className="text-[11px] uppercase tracking-wider text-ink-muted">{label}</p>
    </div>
  )
}

'use client'
import { useActionState, useEffect, useState } from 'react'
import { changePolishStatus } from '@/lib/actions/polishes'
import { Input } from '@/components/ui/field'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/ui/submit-button'
import { Alert } from '@/components/ui/alert'
import { cn } from '@/components/ui/cn'
import { POLISH_STATUS, type PolishStatus } from '@/lib/domain/labels'

const QUICK: { status: PolishStatus; label: string; tone: string }[] = [
  { status: 'por_acabarse', label: 'Por acabarse', tone: 'text-warning' },
  { status: 'terminado', label: 'Terminado', tone: 'text-ink-soft' },
  { status: 'danado', label: 'Dañado', tone: 'text-danger' },
  { status: 'perdido', label: 'Perdido', tone: 'text-danger' },
]

const REASONS: Partial<Record<PolishStatus, string[]>> = {
  por_acabarse: ['Queda poco', 'Se está espesando'],
  terminado: ['Se acabó'],
  danado: ['Se secó', 'Se cayó / se rompió', 'Cambió de color'],
  perdido: ['No se encuentra', 'Se lo llevaron'],
  en_uso: ['En uso en estación'],
  activo: ['Apareció / revisado'],
  dado_de_baja: ['Retirado del inventario'],
}

/** Reporte rápido de estado con motivo; cada cambio queda en el historial. */
export function PolishActions({ polishId, current, extra = [], compact = false }: {
  polishId: string
  current: PolishStatus
  extra?: PolishStatus[]
  compact?: boolean
}) {
  const [state, action] = useActionState(changePolishStatus, {})
  const [target, setTarget] = useState<PolishStatus | null>(null)
  const [reason, setReason] = useState('')

  // Cierra el panel solo cuando el servidor confirma el cambio.
  useEffect(() => {
    if (state.ok) setTarget(null)
  }, [state])

  const options = [
    ...QUICK,
    ...extra.map((s) => ({ status: s, label: POLISH_STATUS[s], tone: 'text-ink-soft' })),
  ].filter((o) => o.status !== current)

  if (target) {
    return (
      <form
        action={action}
        className="space-y-2 rounded-2xl bg-cream/70 p-3"
      >
        <input type="hidden" name="polish_id" value={polishId} />
        <input type="hidden" name="status" value={target} />
        <p className="text-sm font-medium">Marcar como {POLISH_STATUS[target].toLowerCase()}</p>
        <div className="flex flex-wrap gap-1.5">
          {(REASONS[target] ?? []).map((r) => (
            <button key={r} type="button" onClick={() => setReason(r)} className={cn('rounded-full border px-3 py-1.5 text-xs', reason === r ? 'border-ink bg-ink text-cream' : 'border-line bg-card')}>
              {r}
            </button>
          ))}
        </div>
        <Input name="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo" />
        <Input name="comment" placeholder="Comentario (opcional)" />
        {state.error && <Alert>{state.error}</Alert>}
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setTarget(null)}>Cancelar</Button>
          <SubmitButton size="sm" pendingText="…">Confirmar</SubmitButton>
        </div>
      </form>
    )
  }

  return (
    <div className="space-y-2">
    {state.message && <Alert tone="success">{state.message}</Alert>}
    <div className={cn('grid grid-cols-2', compact ? 'gap-1.5' : 'gap-2')}>
      {options.map((o) => (
        <button
          key={o.status}
          type="button"
          onClick={() => {
            setReason(REASONS[o.status]?.[0] ?? '')
            setTarget(o.status)
          }}
          className={cn('h-10 rounded-xl border border-line bg-card text-xs font-medium uppercase tracking-wide', o.tone)}
        >
          {o.label}
        </button>
      ))}
    </div>
    </div>
  )
}

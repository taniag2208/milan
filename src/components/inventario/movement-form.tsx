'use client'
import { useActionState, useState } from 'react'
import { registerMovement } from '@/lib/actions/inventory'
import { Field, Input } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { Alert } from '@/components/ui/alert'
import { cn } from '@/components/ui/cn'
import { MOVEMENT_TYPES, type MovementType } from '@/lib/domain/labels'

export function MovementForm({ itemId, unit, allowed }: { itemId: string; unit: string; allowed: MovementType[] }) {
  const [state, action] = useActionState(registerMovement, {})
  const [type, setType] = useState<MovementType>(allowed.includes('salida') ? 'salida' : allowed[0])
  const needsReason = type === 'ajuste' || type === 'perdida' || type === 'dano'
  return (
    <form action={action} className="space-y-3" key={state.message}>
      <input type="hidden" name="item_id" value={itemId} />
      <input type="hidden" name="movement_type" value={type} />
      <div className={cn('grid gap-2', allowed.length > 3 ? 'grid-cols-3' : 'grid-cols-3')}>
        {allowed.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={cn('h-11 rounded-2xl border text-sm', type === t ? 'border-ink bg-ink text-cream' : 'border-line bg-card text-ink-soft')}
          >
            {MOVEMENT_TYPES[t]}
          </button>
        ))}
      </div>
      <Field label={type === 'ajuste' ? `Cantidad real contada (${unit})` : `Cantidad (${unit})`}>
        <Input name="quantity" inputMode="decimal" required placeholder="0" />
      </Field>
      <Field label={needsReason ? 'Motivo (obligatorio)' : 'Motivo'}>
        <Input name="reason" required={needsReason} placeholder={type === 'entrada' ? 'Compra, devolución…' : type === 'salida' ? 'Uso en servicio…' : 'Ej. se derramó'} />
      </Field>
      <Field label="Observación">
        <Input name="note" placeholder="Opcional" />
      </Field>
      {state.error && <Alert>{state.error}</Alert>}
      {state.message && <Alert tone="success">{state.message}</Alert>}
      <SubmitButton block>Registrar {MOVEMENT_TYPES[type].toLowerCase()}</SubmitButton>
    </form>
  )
}

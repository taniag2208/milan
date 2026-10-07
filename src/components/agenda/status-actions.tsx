'use client'
import Link from 'next/link'
import { useActionState, useState } from 'react'
import { Play, CheckCircle2, Sparkles } from 'lucide-react'
import { changeAppointmentStatus } from '@/lib/actions/appointments'
import { SubmitButton } from '@/components/ui/submit-button'
import { Button, buttonClass } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { Input } from '@/components/ui/field'
import type { AppointmentStatus } from '@/lib/domain/labels'

function StatusForm({
  id,
  status,
  children,
  variant = 'secondary',
  size = 'md',
  confirmMessage,
  reason,
}: {
  id: string
  status: AppointmentStatus
  children: React.ReactNode
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft'
  size?: 'md' | 'lg' | 'sm'
  confirmMessage?: string
  reason?: string
}) {
  const [state, action] = useActionState(changeAppointmentStatus, {})
  return (
    <form action={action} className="contents">
      <input type="hidden" name="appointment_id" value={id} />
      <input type="hidden" name="status" value={status} />
      {reason !== undefined && <input type="hidden" name="reason" value={reason} />}
      <SubmitButton variant={variant} size={size} block confirmMessage={confirmMessage} pendingText="Un momento…">
        {children}
      </SubmitButton>
      {state.error && <Alert className="col-span-full">{state.error}</Alert>}
    </form>
  )
}

/** Acción principal según el estado: pocos toques para la colaboradora. */
export function PrimaryAction({ id, status }: { id: string; status: AppointmentStatus }) {
  if (status === 'pendiente' || status === 'confirmada') {
    return (
      <StatusForm id={id} status="en_servicio" variant="primary" size="lg">
        <Play className="size-5" strokeWidth={1.8} /> Iniciar servicio
      </StatusForm>
    )
  }
  if (status === 'en_servicio') {
    return (
      <Link href={`/agenda/${id}/cerrar`} className={buttonClass('primary', 'lg', true) + ' uppercase tracking-[0.12em]'}>
        <Sparkles className="size-5" strokeWidth={1.8} /> Finalizar servicio
      </Link>
    )
  }
  return null
}

export function SecondaryActions({
  id,
  status,
  canCancel,
  canReactivate,
}: {
  id: string
  status: AppointmentStatus
  canCancel: boolean
  canReactivate: boolean
}) {
  const [cancelling, setCancelling] = useState(false)
  const [reason, setReason] = useState('')

  if (status === 'cancelada' || status === 'no_asistio') {
    return canReactivate ? (
      <div className="grid">
        <StatusForm id={id} status="pendiente">Reactivar cita</StatusForm>
      </div>
    ) : null
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {status === 'pendiente' && (
          <StatusForm id={id} status="confirmada">
            <CheckCircle2 className="size-4" /> Confirmar
          </StatusForm>
        )}
        {status === 'en_servicio' && (
          <StatusForm id={id} status="confirmada" variant="ghost">Deshacer inicio</StatusForm>
        )}
        {(status === 'pendiente' || status === 'confirmada') && (
          <StatusForm id={id} status="no_asistio" variant="ghost" confirmMessage="¿Marcar que la clienta no asistió?">
            No asistió
          </StatusForm>
        )}
        {canCancel && (status === 'pendiente' || status === 'confirmada') && !cancelling && (
          <Button variant="danger" onClick={() => setCancelling(true)}>Cancelar cita</Button>
        )}
      </div>
      {cancelling && (
        <div className="space-y-2 rounded-2xl bg-danger-soft/50 p-3">
          <Input placeholder="Motivo (opcional)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <Button variant="ghost" onClick={() => setCancelling(false)}>Volver</Button>
            <StatusForm id={id} status="cancelada" variant="danger" reason={reason}>Sí, cancelar</StatusForm>
          </div>
        </div>
      )}
    </div>
  )
}

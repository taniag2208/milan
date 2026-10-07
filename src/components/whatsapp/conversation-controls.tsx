'use client'
import { useActionState } from 'react'
import { sendManualReply, setConversationMode } from '@/lib/actions/whatsapp'
import { SubmitButton } from '@/components/ui/submit-button'
import { Textarea } from '@/components/ui/field'
import { Alert } from '@/components/ui/alert'
import type { ConversationMode } from '@/lib/domain/labels'

function ModeButton({ id, mode, children, variant }: { id: string; mode: ConversationMode; children: React.ReactNode; variant: 'primary' | 'secondary' | 'ghost' }) {
  const [state, action] = useActionState(setConversationMode, {})
  return (
    <form action={action}>
      <input type="hidden" name="conversation_id" value={id} />
      <input type="hidden" name="mode" value={mode} />
      <SubmitButton variant={variant} block>{children}</SubmitButton>
      {state.error && <Alert className="mt-2">{state.error}</Alert>}
    </form>
  )
}

export function ConversationControls({ id, mode, canSend }: { id: string; mode: ConversationMode; canSend: boolean }) {
  const [state, action] = useActionState(sendManualReply, {})
  return (
    <div className="space-y-3">
      {mode === 'AI_ACTIVE' && <ModeButton id={id} mode="HUMAN_ACTIVE" variant="primary">Tomar conversación</ModeButton>}
      {mode === 'HUMAN_ACTIVE' && (
        <>
          <form action={action} className="space-y-2" key={state.message}>
            <input type="hidden" name="conversation_id" value={id} />
            <Textarea name="text" placeholder={canSend ? 'Escribe tu respuesta…' : 'WhatsApp aún no está configurado'} disabled={!canSend} />
            {state.error && <Alert>{state.error}</Alert>}
            <SubmitButton block disabled={!canSend} pendingText="Enviando…">Enviar</SubmitButton>
          </form>
          <div className="grid grid-cols-2 gap-2">
            <ModeButton id={id} mode="AI_ACTIVE" variant="secondary">Devolver al agente</ModeButton>
            <ModeButton id={id} mode="CLOSED" variant="ghost">Cerrar</ModeButton>
          </div>
        </>
      )}
      {mode === 'CLOSED' && <ModeButton id={id} mode="HUMAN_ACTIVE" variant="secondary">Reabrir y tomar</ModeButton>}
    </div>
  )
}

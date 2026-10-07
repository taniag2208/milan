'use client'
import { useActionState } from 'react'
import { markCommissionsPaid } from '@/lib/actions/sales'
import { SubmitButton } from '@/components/ui/submit-button'
import { Alert } from '@/components/ui/alert'

export function MarkPaidButton({ staffId, from, to, amount }: { staffId: string; from: string; to: string; amount: string }) {
  const [state, action] = useActionState(markCommissionsPaid, {})
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="staff_id" value={staffId} />
      <input type="hidden" name="from" value={from} />
      <input type="hidden" name="to" value={to} />
      <SubmitButton variant="soft" size="sm" block confirmMessage={`¿Marcar ${amount} como pagado?`}>Marcar como pagadas</SubmitButton>
      {state.error && <Alert>{state.error}</Alert>}
      {state.message && <Alert tone="success">{state.message}</Alert>}
    </form>
  )
}

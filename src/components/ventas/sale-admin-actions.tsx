'use client'
import { useActionState, useState } from 'react'
import { changeSalePayment, voidSale } from '@/lib/actions/sales'
import { Select, Input, Field } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import type { PaymentMethod } from '@/lib/types/db'

export function SaleAdminActions({ saleId, paymentMethodId, paymentMethods }: {
  saleId: string; paymentMethodId: string; paymentMethods: PaymentMethod[]
}) {
  const [payState, payAction] = useActionState(changeSalePayment, {})
  const [voidState, voidAction] = useActionState(voidSale, {})
  const [voiding, setVoiding] = useState(false)
  return (
    <div className="space-y-4">
      <form action={payAction} className="space-y-2">
        <input type="hidden" name="sale_id" value={saleId} />
        <Field label="Corregir medio de pago" group>
          <div className="flex gap-2">
            <Select name="payment_method_id" defaultValue={paymentMethodId} className="flex-1">
              {paymentMethods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
            <SubmitButton variant="secondary" pendingText="…">Guardar</SubmitButton>
          </div>
        </Field>
        {payState.error && <Alert>{payState.error}</Alert>}
        {payState.message && <Alert tone="success">{payState.message}</Alert>}
      </form>
      {voidState.message ? (
        <Alert tone="success">{voidState.message}. La cita quedó lista para cerrarse de nuevo.</Alert>
      ) : voiding ? (
        <form action={voidAction} className="space-y-2 rounded-2xl bg-danger-soft/50 p-3">
          <input type="hidden" name="sale_id" value={saleId} />
          <Input name="reason" placeholder="Motivo de la anulación" required autoFocus />
          {voidState.error && <Alert>{voidState.error}</Alert>}
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="ghost" onClick={() => setVoiding(false)}>Volver</Button>
            <SubmitButton variant="danger" pendingText="Anulando…">Anular venta</SubmitButton>
          </div>
        </form>
      ) : (
        <Button variant="danger" block onClick={() => setVoiding(true)}>Anular venta</Button>
      )}
    </div>
  )
}

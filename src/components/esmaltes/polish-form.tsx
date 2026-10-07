'use client'
import { useActionState } from 'react'
import { createPolish, updatePolish } from '@/lib/actions/polishes'
import { Field, Input, Textarea, ChoiceChips } from '@/components/ui/field'
import { ImagePicker } from '@/components/ui/image-picker'
import { SubmitButton } from '@/components/ui/submit-button'
import { Alert } from '@/components/ui/alert'
import { POLISH_TYPES } from '@/lib/domain/labels'
import type { NailPolish } from '@/lib/types/db'

export function PolishForm({ polish, photoUrl, today }: { polish?: NailPolish; photoUrl?: string | null; today: string }) {
  const [state, action] = useActionState(polish ? updatePolish : createPolish, {})
  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert>{state.error}</Alert>}
      {state.message && <Alert tone="success">{state.message}</Alert>}
      {polish && <input type="hidden" name="id" value={polish.id} />}
      <Field label="Foto"><ImagePicker name="photo" label="Tomar o elegir foto" initialUrl={photoUrl} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Marca"><Input name="brand" defaultValue={polish?.brand} required autoCapitalize="words" /></Field>
        <Field label="Referencia / número"><Input name="reference" defaultValue={polish?.reference ?? ''} /></Field>
      </div>
      <Field label="Nombre o color"><Input name="color_name" defaultValue={polish?.color_name} required /></Field>
      <Field label="Tipo">
        <ChoiceChips name="polish_type" defaultValue={polish?.polish_type ?? 'semipermanente'} options={Object.entries(POLISH_TYPES).map(([value, label]) => ({ value, label }))} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Fecha de ingreso"><Input name="received_at" type="date" defaultValue={polish?.received_at ?? today} /></Field>
        {!polish && <Field label="Código interno" hint="Vacío = automático"><Input name="code" placeholder="E-0001" /></Field>}
      </div>
      <Field label="Observaciones"><Textarea name="notes" defaultValue={polish?.notes ?? ''} /></Field>
      <SubmitButton block size="lg">{polish ? 'Guardar cambios' : 'Registrar esmalte'}</SubmitButton>
      {!polish && (
        <SubmitButton block variant="secondary" name="another" value="1">Guardar y registrar otro</SubmitButton>
      )}
    </form>
  )
}

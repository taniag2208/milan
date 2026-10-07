'use client'
import { useActionState } from 'react'
import { signIn } from '@/lib/actions/auth'
import { Field, Input } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { Alert } from '@/components/ui/alert'

export function LoginForm({ initialError }: { initialError?: string }) {
  const [state, action] = useActionState(signIn, {})
  const error = state.error ?? initialError
  return (
    <form action={action} className="space-y-4">
      {error && <Alert>{error}</Alert>}
      <Field label="Usuario" htmlFor="username">
        <Input
          id="username"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          placeholder="ej. blanca"
        />
      </Field>
      <Field label="Contraseña" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <SubmitButton size="lg" block pendingText="Ingresando…" className="mt-2">
        Ingresar
      </SubmitButton>
    </form>
  )
}

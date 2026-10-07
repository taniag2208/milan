'use client'
import { useActionState, useState } from 'react'
import { addLoginToStaff, createMember, updateAccess, updateMember } from '@/lib/actions/team'
import { Field, Input, Select } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { Alert } from '@/components/ui/alert'
import type { Role } from '@/lib/types/db'

const COLORS = ['#A8957B', '#BCAA8E', '#D2C5AB', '#8C7B6B', '#B59A8A', '#7D8B7A']

function ColorPicker({ defaultValue }: { defaultValue?: string }) {
  const [value, setValue] = useState(defaultValue ?? COLORS[0])
  return (
    <div className="flex gap-2">
      {COLORS.map((c) => (
        <button key={c} type="button" aria-label={`Color ${c}`} onClick={() => setValue(c)}
          className={`size-9 rounded-full ring-offset-2 ${value === c ? 'ring-2 ring-ink' : ''}`} style={{ background: c }} />
      ))}
      <input type="hidden" name="color" value={value} />
    </div>
  )
}

function RoleSelect({ roles, defaultValue }: { roles: Role[]; defaultValue?: string }) {
  return (
    <Select name="role_key" defaultValue={defaultValue ?? 'colaboradora'}>
      {roles.map((r) => <option key={r.id} value={r.key}>{r.name}</option>)}
    </Select>
  )
}

function LoginFields({ roles }: { roles: Role[] }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Usuario" hint="Ej. blanca"><Input name="username" autoCapitalize="none" autoCorrect="off" required /></Field>
        <Field label="Contraseña" hint="Mínimo 8 caracteres"><Input name="password" type="text" autoComplete="new-password" required minLength={8} /></Field>
      </div>
      <Field label="Rol"><RoleSelect roles={roles} /></Field>
    </>
  )
}

export function NewMemberForm({ roles }: { roles: Role[] }) {
  const [state, action] = useActionState(createMember, {})
  const [withLogin, setWithLogin] = useState(true)
  const [attends, setAttends] = useState(true)
  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert>{state.error}</Alert>}
      <Field label="Nombre"><Input name="display_name" required autoCapitalize="words" autoFocus /></Field>
      <label className="flex items-center justify-between rounded-2xl border border-line bg-card px-4 py-3">
        Atiende clientas (aparece en agenda)
        <input type="checkbox" name="attends" checked={attends} onChange={(e) => setAttends(e.target.checked)} className="size-5 accent-ink" />
      </label>
      {attends && (
        <>
          <Field label="Comisión (%)"><Input name="percent" type="number" inputMode="decimal" min={0} max={100} step="0.5" placeholder="50" required /></Field>
          <Field label="Color en agenda"><ColorPicker /></Field>
        </>
      )}
      <label className="flex items-center justify-between rounded-2xl border border-line bg-card px-4 py-3">
        Crear usuario para la app
        <input type="checkbox" name="with_login" checked={withLogin} onChange={(e) => setWithLogin(e.target.checked)} className="size-5 accent-ink" />
      </label>
      {withLogin && <LoginFields roles={roles} />}
      <SubmitButton block size="lg">Crear</SubmitButton>
    </form>
  )
}

export function EditMemberForm({ member }: { member: { id: string; display_name: string; color: string; is_active: boolean; percent: number | null } }) {
  const [state, action] = useActionState(updateMember, {})
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={member.id} />
      <input type="hidden" name="previous_percent" value={member.percent ?? ''} />
      <Field label="Nombre"><Input name="display_name" defaultValue={member.display_name} required /></Field>
      <Field label="Comisión (%)" hint="Aplica a ventas nuevas; las anteriores conservan su porcentaje.">
        <Input name="percent" type="number" inputMode="decimal" min={0} max={100} step="0.5" defaultValue={member.percent ?? ''} />
      </Field>
      <Field label="Color en agenda"><ColorPicker defaultValue={member.color} /></Field>
      <label className="flex items-center justify-between rounded-2xl border border-line bg-card px-4 py-3">
        Activa en agenda
        <input type="checkbox" name="is_active" defaultChecked={member.is_active} className="size-5 accent-ink" />
      </label>
      {state.error && <Alert>{state.error}</Alert>}
      {state.message && <Alert tone="success">{state.message}</Alert>}
      <SubmitButton block>Guardar cambios</SubmitButton>
    </form>
  )
}

export function AddLoginForm({ staffId, fullName, roles }: { staffId: string; fullName: string; roles: Role[] }) {
  const [state, action] = useActionState(addLoginToStaff, {})
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="staff_id" value={staffId} />
      <input type="hidden" name="full_name" value={fullName} />
      <p className="text-sm text-ink-muted">Esta profesional aún no tiene usuario para ingresar a la app.</p>
      <LoginFields roles={roles} />
      {state.error && <Alert>{state.error}</Alert>}
      {state.message && <Alert tone="success">{state.message}</Alert>}
      <SubmitButton block variant="soft">Crear usuario</SubmitButton>
    </form>
  )
}

export function AccessForm({ profile, roles }: { profile: { id: string; username: string; is_active: boolean; roleKey: string }; roles: Role[] }) {
  const [state, action] = useActionState(updateAccess, {})
  return (
    <form action={action} className="space-y-3" key={state.message}>
      <input type="hidden" name="profile_id" value={profile.id} />
      <p className="text-sm">Usuario: <strong className="font-medium">{profile.username}</strong></p>
      <Field label="Rol"><RoleSelect roles={roles} defaultValue={profile.roleKey} /></Field>
      <Field label="Nueva contraseña" hint="Déjala vacía para no cambiarla"><Input name="password" type="text" autoComplete="new-password" minLength={8} /></Field>
      <label className="flex items-center justify-between rounded-2xl border border-line bg-card px-4 py-3">
        Acceso activo
        <input type="checkbox" name="is_active" defaultChecked={profile.is_active} className="size-5 accent-ink" />
      </label>
      {state.error && <Alert>{state.error}</Alert>}
      {state.message && <Alert tone="success">{state.message}</Alert>}
      <SubmitButton block variant="soft">Actualizar acceso</SubmitButton>
    </form>
  )
}

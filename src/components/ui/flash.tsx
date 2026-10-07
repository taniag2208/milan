import { Alert } from './alert'

const MESSAGES: Record<string, string> = {
  creada: 'Cita creada',
  actualizada: 'Cambios guardados',
  guardado: 'Cambios guardados',
  creado: 'Registro creado',
  creada_clienta: 'Clienta creada',
  usuario: 'Usuario creado. Ya puede ingresar con su usuario y contraseña.',
}

/** Mensaje de confirmación tras redirigir (?ok=...). */
export function Flash({ ok }: { ok?: string | string[] }) {
  const key = Array.isArray(ok) ? ok[0] : ok
  if (!key) return null
  return <Alert tone="success" className="mb-4">{MESSAGES[key] ?? 'Listo'}</Alert>
}

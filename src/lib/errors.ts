/** Convierte errores de Supabase/Postgres en mensajes claros en español. */
export function friendlyError(error: { message?: string; code?: string } | null | undefined): string {
  if (!error) return 'Ocurrió un error inesperado. Intenta de nuevo.'
  const { code, message = '' } = error
  if (code === '23505') {
    if (message.includes('phone')) return 'Ya existe una clienta con ese teléfono.'
    if (message.includes('username')) return 'Ese usuario ya existe.'
    if (message.includes('code')) return 'Ese código ya está en uso.'
    return 'Ya existe un registro con esos datos.'
  }
  if (code === '23P01') return message || 'Ese horario ya está ocupado.'
  if (code === '42501') return message.startsWith('new row violates') || message.startsWith('permission denied')
    ? 'No tienes permiso para realizar esta acción.'
    : message
  if (code === '23503') return 'No se puede completar: hay registros relacionados.'
  if (code === 'PGRST116') return 'No se encontró el registro.'
  // Las funciones RPC lanzan mensajes ya pensados para la usuaria.
  if (code && ['P0001', 'P0002', '22023'].includes(code)) return message
  if (message.toLowerCase().includes('fetch failed')) return 'Sin conexión. Revisa el internet e intenta de nuevo.'
  return message || 'Ocurrió un error inesperado. Intenta de nuevo.'
}

export type ActionState = {
  ok?: boolean
  error?: string
  fieldErrors?: Record<string, string>
  message?: string
}

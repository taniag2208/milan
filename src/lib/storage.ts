import 'server-only'
import { createClient } from '@/lib/supabase/server'

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']
const MAX_BYTES = 5 * 1024 * 1024

/** Sube una imagen a Storage con la sesión de la usuaria. Devuelve la ruta. */
export async function uploadImage(bucket: 'esmaltes' | 'referencias', file: File | null): Promise<
  { path: string | null; error?: string }
> {
  if (!file || file.size === 0) return { path: null }
  if (!ALLOWED.includes(file.type)) return { path: null, error: 'La imagen debe ser JPG, PNG, WEBP o HEIC.' }
  if (file.size > MAX_BYTES) return { path: null, error: 'La imagen supera 5 MB.' }
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : file.type === 'image/heic' ? 'heic' : 'jpg'
  const now = new Date()
  const path = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${crypto.randomUUID()}.${ext}`
  const supabase = await createClient()
  const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false })
  if (error) return { path: null, error: 'No se pudo subir la imagen. Intenta de nuevo.' }
  return { path }
}

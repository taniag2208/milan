#!/usr/bin/env node
/**
 * Crea el primer usuario administrador de MILAN.
 *
 * Uso (requiere .env.local con NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY):
 *   npm run create-admin -- <usuario> <contraseña> "<Nombre completo>" [--staff "Blanca"]
 *
 * --staff vincula el usuario con una profesional existente (para que también
 * vea su agenda y comisiones).
 */
import { createClient } from '@supabase/supabase-js'

const args = process.argv.slice(2)
const staffIdx = args.indexOf('--staff')
const staffName = staffIdx >= 0 ? args[staffIdx + 1] : null
const [username, password, fullName] = staffIdx >= 0 ? args.slice(0, staffIdx) : args

if (!username || !password || !fullName) {
  console.error('Uso: npm run create-admin -- <usuario> <contraseña> "<Nombre completo>" [--staff "Blanca"]')
  process.exit(1)
}
if (password.length < 8) {
  console.error('La contraseña debe tener al menos 8 caracteres.')
  process.exit(1)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const domain = process.env.AUTH_USERNAME_DOMAIN || 'usuarios.milan.app'
if (!url || !serviceKey) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local')
  process.exit(1)
}

const user = username.trim().toLowerCase()
if (!/^[a-z0-9._-]{3,32}$/.test(user)) {
  console.error('Usuario inválido: 3–32 caracteres (letras, números, punto, guion).')
  process.exit(1)
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

const { data: role, error: roleError } = await admin.from('roles').select('id').eq('key', 'admin').single()
if (roleError || !role) {
  console.error('No se encontró el rol admin. ¿Aplicaste las migraciones?', roleError?.message ?? '')
  process.exit(1)
}

const { data, error } = await admin.auth.admin.createUser({
  email: `${user}@${domain}`,
  password,
  email_confirm: true,
  user_metadata: { username: user, full_name: fullName },
})
if (error) {
  console.error('No se pudo crear el usuario:', error.message)
  process.exit(1)
}

const { error: profileError } = await admin
  .from('profiles')
  .insert({ id: data.user.id, username: user, full_name: fullName, role_id: role.id })
if (profileError) {
  await admin.auth.admin.deleteUser(data.user.id)
  console.error('No se pudo crear el perfil:', profileError.message)
  process.exit(1)
}

if (staffName) {
  const { data: staff, error: staffError } = await admin
    .from('staff')
    .update({ profile_id: data.user.id })
    .eq('display_name', staffName)
    .select('id')
  if (staffError || !staff?.length) console.warn(`Aviso: no se encontró la profesional "${staffName}" para vincular.`)
}

console.log(`✓ Administrador creado. Ingresa con el usuario "${user}".`)

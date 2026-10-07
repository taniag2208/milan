/** Supabase Auth requiere email: el usuario se convierte en un email técnico interno. */
export function usernameToEmail(username: string): string {
  const domain = process.env.AUTH_USERNAME_DOMAIN || 'usuarios.milan.app'
  return `${normalizeUsername(username)}@${domain}`
}

export function normalizeUsername(username: string): string {
  return username
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '.')
}

export const USERNAME_PATTERN = /^[a-z0-9._-]{3,32}$/

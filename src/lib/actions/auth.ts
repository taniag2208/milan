'use server'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { usernameToEmail } from '@/lib/auth/username'
import type { ActionState } from '@/lib/errors'

export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const username = String(formData.get('username') ?? '')
  const password = String(formData.get('password') ?? '')
  if (!username.trim() || !password) return { error: 'Escribe tu usuario y contraseña.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: usernameToEmail(username),
    password,
  })
  if (error) {
    return {
      error: error.message.toLowerCase().includes('fetch')
        ? 'Sin conexión. Revisa el internet e intenta de nuevo.'
        : 'Usuario o contraseña incorrectos.',
    }
  }
  redirect('/inicio')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

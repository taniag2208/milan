'use client'
import { createBrowserClient } from '@supabase/ssr'

/** Cliente de navegador (subida de fotos a Storage). Respeta RLS. */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

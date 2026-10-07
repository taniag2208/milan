import Image from 'next/image'
import type { Metadata } from 'next'
import { LoginForm } from './login-form'

export const metadata: Metadata = { title: 'Ingresar' }

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const { error } = await searchParams
  return (
    <main className="pt-safe pb-safe mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <div className="mb-12 flex flex-col items-center">
        <Image src="/brand/milan-logo.png" alt="Milán" width={504} height={180} priority className="h-auto w-48" />
        <p className="mt-4 text-xs uppercase tracking-[0.3em] text-ink-muted">Uñas · Pestañas · Spa</p>
      </div>
      <LoginForm initialError={error === 'sin-acceso' ? 'Tu usuario no tiene acceso activo. Habla con administración.' : undefined} />
    </main>
  )
}

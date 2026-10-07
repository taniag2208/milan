import { ButtonLink } from '@/components/ui/button'

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="font-display text-3xl">No encontrado</p>
      <p className="mt-2 text-sm text-ink-muted">Esta página no existe o no tienes acceso.</p>
      <ButtonLink href="/inicio" className="mt-6">Volver al inicio</ButtonLink>
    </main>
  )
}

'use client'
import { Button } from '@/components/ui/button'

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center text-center">
      <p className="font-display text-2xl">Algo salió mal</p>
      <p className="mt-2 max-w-xs text-sm text-ink-muted">
        {error.message?.includes('fetch') ? 'Parece que no hay conexión a internet.' : 'No pudimos cargar esta pantalla.'}
      </p>
      <Button className="mt-6" onClick={reset}>Intentar de nuevo</Button>
    </div>
  )
}

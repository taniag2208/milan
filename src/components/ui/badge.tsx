import type { ReactNode } from 'react'
import { cn } from './cn'

export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'dark'

const tones: Record<Tone, string> = {
  neutral: 'bg-cream text-ink-soft',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-beige text-almond-deep',
  dark: 'bg-ink text-cream',
}

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', tones[tone], className)}>
      {children}
    </span>
  )
}

export const appointmentTone: Record<string, Tone> = {
  pendiente: 'neutral',
  confirmada: 'info',
  en_servicio: 'dark',
  finalizada: 'success',
  cancelada: 'danger',
  no_asistio: 'warning',
}

export const polishTone: Record<string, Tone> = {
  activo: 'success',
  en_uso: 'info',
  por_acabarse: 'warning',
  terminado: 'neutral',
  danado: 'danger',
  perdido: 'danger',
  dado_de_baja: 'neutral',
}

export const stockTone: Record<string, Tone> = {
  disponible: 'success',
  stock_bajo: 'warning',
  agotado: 'danger',
}

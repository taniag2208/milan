import type { ComponentProps } from 'react'
import { cn } from './cn'

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('rounded-[var(--radius-card)] border border-line bg-card p-4 shadow-[var(--shadow-soft)]', className)}
      {...props}
    />
  )
}

export function SectionTitle({ className, ...props }: ComponentProps<'h2'>) {
  return (
    <h2
      className={cn('mb-2 mt-6 px-1 text-xs font-medium uppercase tracking-[0.14em] text-ink-muted first:mt-0', className)}
      {...props}
    />
  )
}

/** Fila de lista tocable dentro de una Card. */
export function ListDivider({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('divide-y divide-line', className)} {...props} />
}

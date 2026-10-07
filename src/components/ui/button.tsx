import Link from 'next/link'
import type { ComponentProps } from 'react'
import { cn } from './cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft'
type Size = 'md' | 'lg' | 'sm'

const base =
  'inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors select-none disabled:opacity-50 disabled:pointer-events-none active:scale-[0.99]'
const variants: Record<Variant, string> = {
  primary: 'bg-ink text-cream hover:bg-ink/90',
  secondary: 'bg-card text-ink border border-line hover:bg-cream/60',
  soft: 'bg-cream text-ink hover:bg-beige',
  ghost: 'text-ink-soft hover:bg-cream/70',
  danger: 'bg-danger-soft text-danger hover:bg-danger-soft/70',
}
const sizes: Record<Size, string> = {
  sm: 'h-9 px-4 text-sm',
  md: 'h-12 px-5 text-[15px]',
  lg: 'h-14 px-6 text-base tracking-wide',
}

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', block = false) {
  return cn(base, variants[variant], sizes[size], block && 'w-full')
}

export function Button({
  variant = 'primary',
  size = 'md',
  block,
  className,
  ...props
}: ComponentProps<'button'> & { variant?: Variant; size?: Size; block?: boolean }) {
  return <button className={cn(buttonClass(variant, size, block), className)} {...props} />
}

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  block,
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size; block?: boolean }) {
  return <Link className={cn(buttonClass(variant, size, block), className)} {...props} />
}

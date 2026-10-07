import type { ComponentProps, ReactNode } from 'react'
import { cn } from './cn'

const control =
  'block w-full rounded-2xl border border-line bg-card px-4 text-base text-ink placeholder:text-ink-muted/70 focus:border-almond focus:outline-none focus:ring-2 focus:ring-beige disabled:bg-cream/50'

export function Field({
  label,
  error,
  hint,
  children,
  className,
  htmlFor,
  group,
}: {
  label?: ReactNode
  error?: string
  hint?: ReactNode
  children: ReactNode
  className?: string
  htmlFor?: string
  /** Para grupos de botones/opciones: usa role="group" en vez de <label>. */
  group?: boolean
}) {
  const message = error ? (
    <p className="px-1 text-sm text-danger" role="alert">{error}</p>
  ) : hint ? (
    <p className="px-1 text-xs text-ink-muted">{hint}</p>
  ) : null
  const labelText = label && <span className="block px-1 text-sm font-medium text-ink-soft">{label}</span>

  if (label && group) {
    return (
      <div role="group" aria-label={typeof label === 'string' ? label : undefined} className={cn('space-y-1.5', className)}>
        {labelText}
        {children}
        {message}
      </div>
    )
  }
  // Sin htmlFor, el <label> envuelve al control para asociarlos (accesibilidad).
  if (label && !htmlFor) {
    return (
      <div className={cn('space-y-1.5', className)}>
        <label className="block space-y-1.5">
          {labelText}
          {children}
        </label>
        {message}
      </div>
    )
  }
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label htmlFor={htmlFor} className="block px-1 text-sm font-medium text-ink-soft">
          {label}
        </label>
      )}
      {children}
      {message}
    </div>
  )
}

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(control, 'h-13 py-3', className)} {...props} />
}

export function Select({ className, children, ...props }: ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        control,
        'h-13 appearance-none bg-[url("data:image/svg+xml;utf8,<svg xmlns=%27http://www.w3.org/2000/svg%27 width=%2716%27 height=%2716%27 fill=%27none%27 stroke=%27%235f564b%27 stroke-width=%271.6%27><path d=%27M4 6l4 4 4-4%27/></svg>")] bg-[length:16px] bg-[right_1rem_center] bg-no-repeat py-3 pr-10',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  )
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cn(control, 'min-h-24 py-3', className)} rows={3} {...props} />
}

/** Grupo de opciones grandes tipo "chip" (radio), ideal para el pulgar. */
export function ChoiceChips({
  name,
  options,
  defaultValue,
  required,
  columns = 2,
}: {
  name: string
  options: { value: string; label: ReactNode }[]
  defaultValue?: string
  required?: boolean
  columns?: 2 | 3
}) {
  return (
    <div className={cn('grid gap-2', columns === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
      {options.map((o) => (
        <label key={o.value} className="relative">
          <input
            type="radio"
            name={name}
            value={o.value}
            defaultChecked={defaultValue === o.value}
            required={required}
            className="peer sr-only"
          />
          <span className="flex h-12 cursor-pointer items-center justify-center rounded-2xl border border-line bg-card px-3 text-center text-[15px] text-ink-soft transition-colors peer-checked:border-ink peer-checked:bg-ink peer-checked:text-cream peer-focus-visible:ring-2 peer-focus-visible:ring-almond">
            {o.label}
          </span>
        </label>
      ))}
    </div>
  )
}

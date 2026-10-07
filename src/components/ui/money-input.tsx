'use client'
import { useState } from 'react'
import { cn } from './cn'

const fmt = (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')

/** Campo de pesos: muestra "45.000" mientras se escribe y envía el entero. */
export function MoneyInput({
  name,
  defaultValue,
  value: controlled,
  onValueChange,
  className,
  id,
  required,
  placeholder = '0',
  autoFocus,
}: {
  name?: string
  defaultValue?: number | null
  value?: number
  onValueChange?: (value: number) => void
  className?: string
  id?: string
  required?: boolean
  placeholder?: string
  autoFocus?: boolean
}) {
  const [internal, setInternal] = useState<number | null>(defaultValue ?? null)
  const value = controlled ?? internal
  return (
    <div className={cn('relative', className)}>
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted">$</span>
      <input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        required={required}
        autoFocus={autoFocus}
        placeholder={placeholder}
        className="tabular block h-13 w-full rounded-2xl border border-line bg-card pl-8 pr-4 text-base text-ink focus:border-almond focus:outline-none focus:ring-2 focus:ring-beige"
        value={value === null || value === undefined ? '' : fmt(value)}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '')
          const n = digits === '' ? 0 : Number.parseInt(digits, 10)
          if (controlled === undefined) setInternal(digits === '' ? null : n)
          onValueChange?.(n)
        }}
      />
      {name && <input type="hidden" name={name} value={value ?? ''} />}
    </div>
  )
}

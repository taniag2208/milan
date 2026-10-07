import { CircleAlert, CircleCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from './cn'

export function Alert({ tone = 'danger', children, className }: {
  tone?: 'danger' | 'success' | 'warning'
  children: ReactNode
  className?: string
}) {
  const Icon = tone === 'success' ? CircleCheck : CircleAlert
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-2 rounded-2xl px-4 py-3 text-sm',
        tone === 'danger' && 'bg-danger-soft text-danger',
        tone === 'success' && 'bg-success-soft text-success',
        tone === 'warning' && 'bg-warning-soft text-warning',
        className,
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div>{children}</div>
    </div>
  )
}

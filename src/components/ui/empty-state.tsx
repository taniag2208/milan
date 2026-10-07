import type { ReactNode } from 'react'

export function EmptyState({ icon, title, description, action }: {
  icon?: ReactNode
  title: string
  description?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center rounded-[var(--radius-card)] border border-dashed border-sandstone/70 px-6 py-10 text-center">
      {icon && <div className="mb-3 text-taupe">{icon}</div>}
      <p className="font-display text-lg text-ink">{title}</p>
      {description && <p className="mt-1 max-w-xs text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

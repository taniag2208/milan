import Link from 'next/link'
import { cn } from './cn'

/** Control segmentado basado en enlaces (mantiene el estado en la URL). */
export function Segmented({ items, active, className }: {
  items: { key: string; label: string; href: string }[]
  active: string
  className?: string
}) {
  return (
    <nav className={cn('flex gap-1 overflow-x-auto rounded-full bg-cream p-1 [scrollbar-width:none]', className)}>
      {items.map((it) => (
        <Link
          key={it.key}
          href={it.href}
          scroll={false}
          aria-current={active === it.key ? 'page' : undefined}
          className={cn(
            'flex h-9 flex-1 shrink-0 items-center justify-center whitespace-nowrap rounded-full px-3 text-sm transition-colors',
            active === it.key ? 'bg-card font-medium text-ink shadow-sm' : 'text-ink-soft',
          )}
        >
          {it.label}
        </Link>
      ))}
    </nav>
  )
}

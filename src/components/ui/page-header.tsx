import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'

export function PageHeader({
  title,
  subtitle,
  backHref,
  action,
}: {
  title: ReactNode
  subtitle?: ReactNode
  backHref?: string
  action?: ReactNode
}) {
  return (
    <header className="pt-safe sticky top-0 z-20 -mx-4 mb-4 bg-page/90 px-4 backdrop-blur-md lg:mx-0 lg:mb-6 lg:px-0 lg:pt-4">
      <div className="flex min-h-16 items-center gap-2 py-3">
        {backHref && (
          <Link
            href={backHref}
            aria-label="Volver"
            className={`-ml-2 grid size-10 shrink-0 place-items-center rounded-full text-ink-soft hover:bg-cream ${backHref === '/mas' ? 'lg:hidden' : ''}`}
          >
            <ChevronLeft className="size-6" strokeWidth={1.6} />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-[1.65rem] leading-tight text-ink">{title}</h1>
          {subtitle && <p className="truncate text-sm text-ink-muted first-letter:uppercase">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </header>
  )
}

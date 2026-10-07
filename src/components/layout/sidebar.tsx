'use client'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarPlus, LogOut } from 'lucide-react'
import { cn } from '@/components/ui/cn'
import { signOut } from '@/lib/actions/auth'
import type { NavSection } from '@/lib/auth/navigation'
import { NavIcon } from './nav-icon'

/** Menú lateral para pantallas grandes (en celular se usa la barra inferior). */
export function Sidebar({ sections, user, canCreateAppointment }: {
  sections: NavSection[]
  user: { fullName: string; username: string; roleName: string }
  canCreateAppointment: boolean
}) {
  const pathname = usePathname()
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-card/70 backdrop-blur-md lg:flex">
      <Link href="/inicio" className="flex h-20 items-center px-7">
        <Image src="/brand/milan-logo.png" alt="Milán" width={504} height={180} className="h-auto w-28" priority />
      </Link>
      {canCreateAppointment && (
        <div className="px-4 pb-4">
          <Link href="/agenda/nueva" className="flex h-11 items-center justify-center gap-2 rounded-full bg-ink text-sm font-medium text-cream hover:bg-ink/90">
            <CalendarPlus className="size-4" /> Nueva cita
          </Link>
        </div>
      )}
      <nav aria-label="Navegación principal" className="flex-1 overflow-y-auto px-3 pb-4">
        {sections.map((section, i) => (
          <div key={i} className={i > 0 ? 'mt-5' : ''}>
            {section.title && (
              <p className="mb-1 px-4 text-[11px] font-medium uppercase tracking-[0.14em] text-ink-muted">{section.title}</p>
            )}
            {section.items.map((item) => {
              const active = pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex h-10 items-center gap-3 rounded-full px-4 text-[15px] transition-colors',
                    active ? 'bg-cream font-medium text-ink' : 'text-ink-soft hover:bg-cream/60',
                  )}
                >
                  <NavIcon name={item.icon} className={cn('size-[18px]', active ? 'text-ink' : 'text-almond')} strokeWidth={active ? 1.8 : 1.5} />
                  {item.label}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>
      <div className="border-t border-line p-4">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-cream font-display text-lg text-almond-deep">{user.fullName.charAt(0)}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user.fullName}</p>
            <p className="truncate text-xs text-ink-muted">{user.roleName}</p>
          </div>
          <form action={signOut}>
            <button type="submit" aria-label="Cerrar sesión" className="grid size-9 place-items-center rounded-full text-ink-muted hover:bg-cream">
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  )
}

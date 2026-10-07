'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarDays, Home, LayoutGrid, Plus, Users } from 'lucide-react'
import { cn } from '@/components/ui/cn'

export interface FabTargets {
  appointment: boolean
  customer: boolean
  polish: boolean
  inventory: boolean
  service: boolean
}

const ITEMS = [
  { href: '/inicio', label: 'Inicio', icon: Home },
  { href: '/agenda', label: 'Agenda', icon: CalendarDays },
  null,
  { href: '/clientes', label: 'Clientes', icon: Users },
  { href: '/mas', label: 'Más', icon: LayoutGrid },
] as const

const MORE_SECTIONS = ['/mas', '/ventas', '/comisiones', '/inventario', '/esmaltes', '/servicios', '/equipo', '/configuracion', '/whatsapp', '/auditoria']

/** El botón central cambia según la sección: la acción más frecuente en contexto. */
function fabFor(pathname: string, t: FabTargets): { href: string; label: string } | null {
  if (pathname.startsWith('/clientes') && t.customer) return { href: '/clientes/nueva', label: 'Nueva clienta' }
  if (pathname.startsWith('/esmaltes') && t.polish) return { href: '/esmaltes/nuevo', label: 'Nuevo esmalte' }
  if (pathname.startsWith('/inventario') && t.inventory) return { href: '/inventario/nuevo', label: 'Nuevo producto' }
  if (pathname.startsWith('/servicios') && t.service) return { href: '/servicios/nuevo', label: 'Nuevo servicio' }
  if (t.appointment) return { href: '/agenda/nueva', label: 'Nueva cita' }
  return null
}

export function BottomNav({ fab }: { fab: FabTargets }) {
  const pathname = usePathname()
  const action = fabFor(pathname, fab)
  const isActive = (href: string) =>
    href === '/mas' ? MORE_SECTIONS.some((s) => pathname.startsWith(s)) : pathname.startsWith(href)

  return (
    <nav
      aria-label="Navegación principal"
      className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 backdrop-blur-md"
    >
      <div className="mx-auto grid h-16 max-w-xl grid-cols-5 items-center">
        {ITEMS.map((item) => {
          if (!item) {
            return action ? (
              <div key="fab" className="flex justify-center">
                <Link
                  href={action.href}
                  aria-label={action.label}
                  className="-mt-7 grid size-15 place-items-center rounded-full bg-ink text-cream shadow-lg shadow-ink/20 ring-4 ring-page transition-transform active:scale-95"
                >
                  <Plus className="size-7" strokeWidth={1.7} />
                </Link>
              </div>
            ) : (
              <div key="fab" />
            )
          }
          const Icon = item.icon
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex h-full flex-col items-center justify-center gap-1 text-[11px] tracking-wide transition-colors',
                active ? 'text-ink' : 'text-ink-muted',
              )}
            >
              <Icon className="size-[22px]" strokeWidth={active ? 1.9 : 1.5} />
              <span className={active ? 'font-medium' : ''}>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

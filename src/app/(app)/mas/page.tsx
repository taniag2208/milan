import Link from 'next/link'
import type { Metadata } from 'next'
import { ChevronRight, ClipboardList, LogOut } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { SectionTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { NavIcon } from '@/components/layout/nav-icon'
import { requireSession } from '@/lib/auth/session'
import { navigationFor, type NavItem } from '@/lib/auth/navigation'
import { signOut } from '@/lib/actions/auth'

export const metadata: Metadata = { title: 'Más' }

export default async function MorePage() {
  const session = await requireSession()
  // Inicio, Agenda y Clientes ya están en la barra inferior.
  const sections = navigationFor(session).filter((s) => s.title && s.items.length)

  return (
    <div className="lg:mx-auto lg:max-w-2xl">
      <PageHeader title="Más" />
      <div className="flex items-center gap-3 rounded-[var(--radius-card)] bg-cream/70 px-4 py-3">
        <span className="grid size-11 place-items-center rounded-full bg-card font-display text-xl text-almond-deep">
          {session.fullName.charAt(0)}
        </span>
        <div>
          <p className="font-medium">{session.fullName}</p>
          <p className="text-sm text-ink-muted">@{session.username} · {session.roleName}</p>
        </div>
      </div>

      {sections.map((s) => (
        <div key={s.title} className="mt-6">
          <SectionTitle>{s.title}</SectionTitle>
          <Menu items={s.items} />
        </div>
      ))}

      <form action={signOut} className="mt-8">
        <Button variant="ghost" block type="submit"><LogOut className="size-4" /> Cerrar sesión</Button>
      </form>
      <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-ink-muted lg:hidden">
        <ClipboardList className="size-3.5" /> Instálala: menú del navegador → “Agregar a pantalla de inicio”.
      </p>
    </div>
  )
}

function Menu({ items }: { items: NavItem[] }) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-card">
      {items.map((item) => (
        <li key={item.href}>
          <Link href={item.href} className="flex h-14 items-center gap-3 px-4 active:bg-cream/60">
            <NavIcon name={item.icon} className="size-5 text-almond" />
            <span className="flex-1">{item.label}</span>
            <ChevronRight className="size-4 text-taupe" />
          </Link>
        </li>
      ))}
    </ul>
  )
}

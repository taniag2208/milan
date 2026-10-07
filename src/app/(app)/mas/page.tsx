import Link from 'next/link'
import type { Metadata } from 'next'
import {
  ChevronRight, ClipboardList, Droplet, LogOut, MessageCircle, Package, Percent, Receipt,
  Scissors, Settings, ShieldCheck, Users,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { SectionTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { can, requireSession, type Permission } from '@/lib/auth/session'
import { signOut } from '@/lib/actions/auth'

export const metadata: Metadata = { title: 'Más' }

type Item = { href: string; label: string; icon: typeof Receipt; any: Permission[] | 'all'; hint?: string }

const OPERATION: Item[] = [
  { href: '/ventas', label: 'Ventas y caja', icon: Receipt, any: ['sales.read_all', 'sales.create'] },
  { href: '/comisiones', label: 'Comisiones', icon: Percent, any: 'all' },
  { href: '/inventario', label: 'Inventario', icon: Package, any: 'all' },
  { href: '/esmaltes', label: 'Esmaltes', icon: Droplet, any: 'all' },
]
const ADMIN: Item[] = [
  { href: '/servicios', label: 'Servicios y precios', icon: Scissors, any: ['services.manage'] },
  { href: '/equipo', label: 'Equipo y usuarios', icon: Users, any: ['users.manage'] },
  { href: '/configuracion', label: 'Configuración', icon: Settings, any: ['settings.manage'] },
  { href: '/whatsapp', label: 'Conversaciones WhatsApp', icon: MessageCircle, any: ['whatsapp.manage'] },
  { href: '/auditoria', label: 'Auditoría', icon: ShieldCheck, any: ['audit.read'] },
]

export default async function MorePage() {
  const session = await requireSession()
  const visible = (items: Item[]) => items.filter((i) => i.any === 'all' || i.any.some((p) => can(session, p)))
  const admin = visible(ADMIN)
  const operation = visible(OPERATION).map((i) =>
    i.href === '/ventas' && !can(session, 'sales.read_all') ? { ...i, label: 'Mis ventas' } : i,
  )

  return (
    <>
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

      <SectionTitle>Operación</SectionTitle>
      <Menu items={operation} />
      {admin.length > 0 && (
        <>
          <SectionTitle>Administración</SectionTitle>
          <Menu items={admin} />
        </>
      )}

      <form action={signOut} className="mt-8">
        <Button variant="ghost" block type="submit"><LogOut className="size-4" /> Cerrar sesión</Button>
      </form>
      <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-ink-muted">
        <ClipboardList className="size-3.5" /> Instálala: menú del navegador → “Agregar a pantalla de inicio”.
      </p>
    </>
  )
}

function Menu({ items }: { items: Item[] }) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-card">
      {items.map(({ href, label, icon: Icon }) => (
        <li key={href}>
          <Link href={href} className="flex h-14 items-center gap-3 px-4 active:bg-cream/60">
            <Icon className="size-5 text-almond" strokeWidth={1.5} />
            <span className="flex-1">{label}</span>
            <ChevronRight className="size-4 text-taupe" />
          </Link>
        </li>
      ))}
    </ul>
  )
}

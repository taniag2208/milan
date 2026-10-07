import Link from 'next/link'
import type { Metadata } from 'next'
import { ChevronRight } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { SectionTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ButtonLink } from '@/components/ui/button'
import { Flash } from '@/components/ui/flash'
import { Alert } from '@/components/ui/alert'
import { requirePermission } from '@/lib/auth/session'
import { listTeam, listUsersWithoutStaff } from '@/lib/data/team'
import { hasServiceRole } from '@/lib/supabase/admin'

export const metadata: Metadata = { title: 'Equipo' }

export default async function TeamPage({ searchParams }: PageProps<'/equipo'>) {
  await requirePermission('users.manage')
  const sp = await searchParams
  const [team, users] = await Promise.all([listTeam(), listUsersWithoutStaff()])
  return (
    <>
      <PageHeader title="Equipo y usuarios" backHref="/mas" action={<ButtonLink href="/equipo/nuevo" size="sm" variant="soft">+ Agregar</ButtonLink>} />
      <Flash ok={sp.ok} />
      {!hasServiceRole() && (
        <Alert tone="warning" className="mb-4">Para crear usuarios y contraseñas falta configurar SUPABASE_SERVICE_ROLE_KEY en el servidor (Vercel).</Alert>
      )}
      <SectionTitle>Profesionales</SectionTitle>
      <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-card">
        {team.map((m) => (
          <li key={m.id}>
            <Link href={`/equipo/${m.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-cream/60">
              <span className="size-3 rounded-full" style={{ background: m.color }} />
              <span className="min-w-0 flex-1">
                <span className={`block font-medium ${m.is_active ? '' : 'text-ink-muted line-through'}`}>{m.display_name}</span>
                <span className="block text-sm text-ink-muted">
                  {m.profile ? `@${m.profile.username} · ${m.profile.roles?.name}` : 'Sin usuario'}
                </span>
              </span>
              <span className="font-display text-xl tabular">{m.percent != null ? `${Number(m.percent)}%` : '—'}</span>
              <ChevronRight className="size-4 text-taupe" />
            </Link>
          </li>
        ))}
      </ul>
      {users.length > 0 && (
        <>
          <SectionTitle>Otros usuarios</SectionTitle>
          <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-card">
            {users.map((u) => (
              <li key={u.id}>
                <Link href={`/equipo/usuario/${u.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-cream/60">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{u.full_name}</span>
                    <span className="block text-sm text-ink-muted">@{u.username} · {u.roles?.name}</span>
                  </span>
                  {!u.is_active && <Badge tone="danger">Inactivo</Badge>}
                  <ChevronRight className="size-4 text-taupe" />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}

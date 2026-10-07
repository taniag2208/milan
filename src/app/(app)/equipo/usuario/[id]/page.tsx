import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { AccessForm } from '@/components/equipo/member-forms'
import { requirePermission } from '@/lib/auth/session'
import { listRoles, listUsersWithoutStaff } from '@/lib/data/team'

export const metadata: Metadata = { title: 'Usuario' }

export default async function UserPage({ params }: PageProps<'/equipo/usuario/[id]'>) {
  await requirePermission('users.manage')
  const { id } = await params
  const [users, roles] = await Promise.all([listUsersWithoutStaff(), listRoles()])
  const u = users.find((x) => x.id === id)
  if (!u) notFound()
  return (
    <div className="lg:mx-auto lg:max-w-2xl">
      <PageHeader title={u.full_name} subtitle="Usuario" backHref="/equipo" />
      <Card>
        <AccessForm profile={{ id: u.id, username: u.username, is_active: u.is_active, roleKey: u.roles?.key ?? 'admin' }} roles={roles} />
      </Card>
    </div>
  )
}

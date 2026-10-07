import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui/page-header'
import { NewMemberForm } from '@/components/equipo/member-forms'
import { requirePermission } from '@/lib/auth/session'
import { listRoles } from '@/lib/data/team'

export const metadata: Metadata = { title: 'Agregar al equipo' }

export default async function NewMemberPage() {
  await requirePermission('users.manage')
  const roles = await listRoles()
  return (
    <div className="lg:mx-auto lg:max-w-2xl">
      <PageHeader title="Agregar al equipo" backHref="/equipo" />
      <NewMemberForm roles={roles} />
    </div>
  )
}

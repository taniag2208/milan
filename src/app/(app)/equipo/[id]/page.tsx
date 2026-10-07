import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui/page-header'
import { Card, SectionTitle } from '@/components/ui/card'
import { Flash } from '@/components/ui/flash'
import { AccessForm, AddLoginForm, EditMemberForm } from '@/components/equipo/member-forms'
import { requirePermission } from '@/lib/auth/session'
import { getCommissionHistory, listRoles, listTeam } from '@/lib/data/team'
import { formatShortDate, toLocalDate } from '@/lib/domain/dates'

export const metadata: Metadata = { title: 'Profesional' }

export default async function MemberPage({ params, searchParams }: PageProps<'/equipo/[id]'>) {
  await requirePermission('users.manage')
  const [{ id }, sp] = await Promise.all([params, searchParams])
  const [team, roles, history] = await Promise.all([listTeam(), listRoles(), getCommissionHistory(id)])
  const m = team.find((t) => t.id === id)
  if (!m) notFound()
  return (
    <div className="lg:mx-auto lg:max-w-2xl">
      <PageHeader title={m.display_name} subtitle="Profesional" backHref="/equipo" />
      <Flash ok={sp.ok} />
      <Card><EditMemberForm member={m} /></Card>

      <SectionTitle>Acceso a la app</SectionTitle>
      <Card>
        {m.profile ? (
          <AccessForm profile={{ id: m.profile.id, username: m.profile.username, is_active: m.profile.is_active, roleKey: m.profile.roles?.key ?? 'colaboradora' }} roles={roles} />
        ) : (
          <AddLoginForm staffId={m.id} fullName={m.display_name} roles={roles} />
        )}
      </Card>

      {history.length > 0 && (
        <>
          <SectionTitle>Historial de comisión</SectionTitle>
          <Card className="divide-y divide-line py-1 text-sm">
            {history.map((h) => (
              <div key={h.id} className="flex justify-between py-2">
                <span className="text-ink-muted">Desde {formatShortDate(toLocalDate(h.effective_from))}</span>
                <span className="font-medium tabular">{Number(h.percent)}%</span>
              </div>
            ))}
          </Card>
        </>
      )}
    </div>
  )
}

import { BottomNav } from '@/components/layout/bottom-nav'
import { Sidebar } from '@/components/layout/sidebar'
import { can, requireSession } from '@/lib/auth/session'
import { navigationFor } from '@/lib/auth/navigation'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession()
  const canCreateAppointment = can(session, 'appointments.manage_all') || can(session, 'appointments.create')
  const fab = {
    appointment: canCreateAppointment,
    customer: can(session, 'customers.manage'),
    polish: can(session, 'polishes.manage'),
    inventory: can(session, 'inventory.manage'),
    service: can(session, 'services.manage'),
  }
  return (
    <>
      <Sidebar
        sections={navigationFor(session)}
        user={{ fullName: session.fullName, username: session.username, roleName: session.roleName }}
        canCreateAppointment={canCreateAppointment}
      />
      <div className="lg:pl-64">
        <main className="mx-auto min-h-dvh max-w-xl px-4 pb-32 lg:max-w-6xl lg:px-10 lg:pb-16">{children}</main>
      </div>
      <BottomNav fab={fab} />
    </>
  )
}

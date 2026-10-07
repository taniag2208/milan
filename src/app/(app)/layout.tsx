import { BottomNav } from '@/components/layout/bottom-nav'
import { can, requireSession } from '@/lib/auth/session'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession()
  const fab = {
    appointment: can(session, 'appointments.manage_all') || can(session, 'appointments.create'),
    customer: can(session, 'customers.manage'),
    polish: can(session, 'polishes.manage'),
    inventory: can(session, 'inventory.manage'),
    service: can(session, 'services.manage'),
  }
  return (
    <>
      <main className="mx-auto min-h-dvh max-w-xl px-4 pb-32">{children}</main>
      <BottomNav fab={fab} />
    </>
  )
}

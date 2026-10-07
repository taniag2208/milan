import Link from 'next/link'
import { Badge, appointmentTone } from '@/components/ui/badge'
import { APPOINTMENT_STATUS } from '@/lib/domain/labels'
import { formatTime } from '@/lib/domain/dates'
import { serviceNames, type AppointmentListItem } from '@/lib/data/appointments'
import { cn } from '@/components/ui/cn'

export function AppointmentCard({ appointment: a, showStaff = true }: { appointment: AppointmentListItem; showStaff?: boolean }) {
  const muted = a.status === 'cancelada' || a.status === 'no_asistio'
  return (
    <Link
      href={`/agenda/${a.id}`}
      className={cn(
        'flex gap-3 rounded-[var(--radius-card)] border border-line bg-card p-3.5 shadow-[var(--shadow-soft)] transition-colors active:bg-cream/60',
        a.status === 'en_servicio' && 'border-ink/40',
        muted && 'opacity-60',
      )}
    >
      <div className="w-16 shrink-0 pt-0.5">
        <p className="tabular text-[15px] font-medium text-ink">{formatTime(a.starts_at).replace(' ', ' ')}</p>
        <p className="tabular text-xs text-ink-muted">{formatTime(a.ends_at)}</p>
      </div>
      <div className="min-w-0 flex-1 border-l border-line pl-3">
        <div className="flex items-start justify-between gap-2">
          <p className={cn('truncate font-medium text-ink', muted && 'line-through')}>{a.customers?.full_name ?? 'Clienta'}</p>
          <Badge tone={appointmentTone[a.status]} className="shrink-0">{APPOINTMENT_STATUS[a.status]}</Badge>
        </div>
        <p className="mt-0.5 truncate text-sm text-ink-soft">{serviceNames(a) || 'Sin servicio'}</p>
        {showStaff && a.staff && (
          <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-muted">
            <span className="size-2 rounded-full" style={{ background: a.staff.color }} />
            {a.staff.display_name}
          </p>
        )}
      </div>
    </Link>
  )
}

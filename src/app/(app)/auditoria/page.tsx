import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { requirePermission } from '@/lib/auth/session'
import { listAudit } from '@/lib/data/audit'
import { formatShortDate, formatTime, toLocalDate } from '@/lib/domain/dates'

export const metadata: Metadata = { title: 'Auditoría' }

const ACTIONS: Record<string, string> = {
  'sale.void': 'Venta anulada',
  'appointment.cancelada': 'Cita cancelada',
  'appointment.no_asistio': 'No asistió',
  'appointment.pendiente': 'Cita reactivada',
  'appointment.reschedule': 'Cita reprogramada',
  'inventory.ajuste': 'Ajuste de inventario',
  'inventory.perdida': 'Pérdida de inventario',
  'inventory.dano': 'Daño de inventario',
  'polish.perdido': 'Esmalte perdido',
  'polish.danado': 'Esmalte dañado',
  'polish.dado_de_baja': 'Esmalte dado de baja',
  'whatsapp.mode': 'Cambio en conversación',
}

const ENTITIES: Record<string, string> = {
  services: 'Servicio', service_extras: 'Extra', sales: 'Venta', commission_rules: 'Regla de comisión',
  commission_records: 'Comisión', profiles: 'Usuario', staff: 'Profesional', business_settings: 'Configuración',
  role_permissions: 'Permisos', payment_methods: 'Medio de pago', inventory_items: 'Producto',
  nail_polishes: 'Esmalte', service_categories: 'Categoría', roles: 'Rol', customers: 'Clienta',
}

function describe(action: string, entity: string) {
  if (ACTIONS[action]) return ACTIONS[action]
  const op = action.endsWith('.insert') ? 'creado' : action.endsWith('.update') ? 'modificado' : action.endsWith('.delete') ? 'eliminado' : action
  return `${ENTITIES[entity] ?? entity} ${op}`
}

export default async function AuditPage() {
  await requirePermission('audit.read')
  const logs = await listAudit(150)
  return (
    <div className="lg:mx-auto lg:max-w-4xl">
      <PageHeader title="Auditoría" subtitle="Últimos 150 cambios sensibles" backHref="/mas" />
      {logs.length === 0 ? (
        <EmptyState title="Sin registros" />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-card">
          {logs.map((l) => {
            const changes = (l.metadata?.cambios ?? null) as Record<string, { antes: unknown; despues: unknown }> | null
            return (
              <li key={l.id} className="px-4 py-3 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="font-medium">{describe(l.action, l.entity)}</span>
                  <span className="shrink-0 text-ink-muted">{formatShortDate(toLocalDate(l.created_at), false)} {formatTime(l.created_at)}</span>
                </div>
                <p className="text-ink-muted">{l.actor?.full_name ?? 'Sistema'}</p>
                {changes && (
                  <p className="mt-1 break-words text-xs text-ink-soft">
                    {Object.entries(changes).slice(0, 4).map(([k, v]) => `${k}: ${JSON.stringify(v.antes)} → ${JSON.stringify(v.despues)}`).join(' · ')}
                  </p>
                )}
                {typeof l.metadata?.motivo === 'string' && <p className="mt-1 text-xs text-ink-soft">Motivo: {l.metadata.motivo}</p>}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

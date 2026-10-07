import Link from 'next/link'
import type { Metadata } from 'next'
import { Search, Users } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { ButtonLink } from '@/components/ui/button'
import { cn } from '@/components/ui/cn'
import { can, canViewMoney, requireSession } from '@/lib/auth/session'
import { searchCustomers } from '@/lib/data/customers'
import { SEGMENTS, type Segment } from '@/lib/domain/labels'
import { formatPhone } from '@/lib/domain/phone'
import { formatShortDate, toLocalDate } from '@/lib/domain/dates'

export const metadata: Metadata = { title: 'Clientes' }

export default async function CustomersPage({ searchParams }: PageProps<'/clientes'>) {
  const [session, sp] = await Promise.all([requireSession(), searchParams])
  const q = typeof sp.q === 'string' ? sp.q : ''
  const segment = (Object.keys(SEGMENTS) as Segment[]).includes(sp.segmento as Segment) ? (sp.segmento as Segment) : null
  const customers = await searchCustomers({ q, segment })
  const seeAll = can(session, 'customers.read_all')
  const link = (seg: Segment | null) => {
    const p = new URLSearchParams()
    if (q) p.set('q', q)
    if (seg) p.set('segmento', seg)
    return `/clientes${p.size ? `?${p}` : ''}`
  }

  return (
    <>
      <PageHeader title="Clientes" subtitle={seeAll ? undefined : 'Clientas que has atendido'} />
      <form method="get" className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Buscar por nombre o teléfono"
          className="h-12 w-full rounded-full border border-line bg-card pl-10 pr-4 text-base focus:border-almond focus:outline-none"
        />
        {segment && <input type="hidden" name="segmento" value={segment} />}
      </form>

      {canViewMoney(session) && (
        <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {[null, ...(Object.keys(SEGMENTS) as Segment[])].map((s) => (
            <Link
              key={s ?? 'todas'}
              href={link(s)}
              className={cn(
                'flex h-9 shrink-0 items-center rounded-full border px-3.5 text-sm',
                segment === s ? 'border-ink bg-ink text-cream' : 'border-line bg-card text-ink-soft',
              )}
            >
              {s ? SEGMENTS[s] : 'Todas'}
            </Link>
          ))}
        </div>
      )}

      <div className="mt-4">
        {customers.length === 0 ? (
          <EmptyState
            icon={<Users className="size-8" strokeWidth={1.3} />}
            title={q || segment ? 'Sin resultados' : 'Aún no hay clientas'}
            description={q ? 'Prueba con otro nombre o con el teléfono.' : 'Las clientas se crean automáticamente al agendar.'}
            action={can(session, 'customers.manage') ? <ButtonLink href="/clientes/nueva">+ Nueva clienta</ButtonLink> : undefined}
          />
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-card">
            {customers.map((c) => (
              <li key={c.id}>
                <Link href={`/clientes/${c.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-cream/60">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-cream font-display text-lg text-almond-deep">
                    {c.full_name.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{c.full_name}</span>
                    <span className="block truncate text-sm text-ink-muted tabular">
                      {formatPhone(c.phone_e164)}
                      {c.stats?.last_visit_at && ` · ${formatShortDate(toLocalDate(c.stats.last_visit_at), false)}`}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    {c.segments.includes('vip') && <Badge tone="dark">VIP</Badge>}
                    {c.segments.includes('por_reactivar') && <Badge tone="warning">Reactivar</Badge>}
                    {c.segments.includes('cumpleanos_proximo') && <Badge tone="info">Cumpleaños</Badge>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

import Link from 'next/link'
import type { Metadata } from 'next'
import { Droplet, Search } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Badge, polishTone } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { ButtonLink } from '@/components/ui/button'
import { cn } from '@/components/ui/cn'
import { PolishActions } from '@/components/esmaltes/polish-actions'
import { can, requireSession } from '@/lib/auth/session'
import { listPolishes, polishPhotoUrl } from '@/lib/data/polishes'
import { POLISH_STATUS, type PolishStatus } from '@/lib/domain/labels'

export const metadata: Metadata = { title: 'Esmaltes' }

const FILTERS: { key: string; label: string }[] = [
  { key: '', label: 'Todos' },
  { key: 'activos', label: 'Activos' },
  { key: 'por_acabarse', label: 'Por acabarse' },
  { key: 'terminado', label: 'Terminados' },
  { key: 'danado', label: 'Dañados' },
  { key: 'perdido', label: 'Perdidos' },
  { key: 'dado_de_baja', label: 'De baja' },
]

export default async function PolishesPage({ searchParams }: PageProps<'/esmaltes'>) {
  const [session, sp] = await Promise.all([requireSession(), searchParams])
  const estado = FILTERS.some((f) => f.key === sp.estado) ? (sp.estado as string) : ''
  const q = typeof sp.q === 'string' ? sp.q : ''
  const polishes = await listPolishes({ q, status: (estado || null) as PolishStatus | 'activos' | null })
  const canReport = can(session, 'polishes.report') || can(session, 'polishes.manage')
  const href = (k: string) => {
    const p = new URLSearchParams()
    if (k) p.set('estado', k)
    if (q) p.set('q', q)
    return `/esmaltes${p.size ? `?${p}` : ''}`
  }

  return (
    <>
      <PageHeader title="Esmaltes" subtitle={`${polishes.length} en la lista`} backHref="/mas" />
      <form method="get" className="relative lg:max-w-md">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
        <input type="search" name="q" defaultValue={q} placeholder="Marca, color, referencia o código" className="h-12 w-full rounded-full border border-line bg-card pl-10 pr-4 focus:border-almond focus:outline-none" />
        {estado && <input type="hidden" name="estado" value={estado} />}
      </form>
      <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {FILTERS.map((f) => (
          <Link key={f.key} href={href(f.key)} className={cn('flex h-9 shrink-0 items-center rounded-full border px-3.5 text-sm', estado === f.key ? 'border-ink bg-ink text-cream' : 'border-line bg-card text-ink-soft')}>
            {f.label}
          </Link>
        ))}
      </div>

      <div className="mt-4">
        {polishes.length === 0 ? (
          <EmptyState
            icon={<Droplet className="size-8" strokeWidth={1.3} />}
            title={q || estado ? 'Sin resultados' : 'Aún no hay esmaltes'}
            description="Cada esmalte es una unidad con código, foto e historial."
            action={can(session, 'polishes.manage') ? <ButtonLink href="/esmaltes/nuevo">+ Nuevo esmalte</ButtonLink> : undefined}
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {polishes.map((p) => {
              const photo = polishPhotoUrl(p.photo_path)
              return (
                <div key={p.id} className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-card shadow-[var(--shadow-soft)]">
                  <Link href={`/esmaltes/${p.id}`} className="flex gap-3 p-3">
                    {photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photo} alt={`${p.brand} ${p.color_name}`} className="size-20 shrink-0 rounded-2xl object-cover" loading="lazy" />
                    ) : (
                      <div className="grid size-20 shrink-0 place-items-center rounded-2xl bg-cream"><Droplet className="size-7 text-taupe" strokeWidth={1.3} /></div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs uppercase tracking-wider text-ink-muted">{p.brand}</p>
                      <p className="truncate font-medium">{p.color_name}</p>
                      <p className="text-sm text-ink-muted">{[p.reference, p.code].filter(Boolean).join(' · ')}</p>
                      <Badge tone={polishTone[p.status]} className="mt-1">{POLISH_STATUS[p.status]}</Badge>
                    </div>
                  </Link>
                  {canReport && p.status !== 'dado_de_baja' && (
                    <div className="border-t border-line p-2">
                      <PolishActions polishId={p.id} current={p.status} compact />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}

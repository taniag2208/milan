import Link from 'next/link'
import type { Metadata } from 'next'
import { ChevronRight } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, SectionTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ButtonLink } from '@/components/ui/button'
import { Flash } from '@/components/ui/flash'
import { CategoryForm, ExtrasManager } from '@/components/servicios/extras-manager'
import { requirePermission } from '@/lib/auth/session'
import { getCatalog } from '@/lib/data/catalog'
import { formatCOP } from '@/lib/domain/money'
import { formatDuration } from '@/lib/domain/dates'

export const metadata: Metadata = { title: 'Servicios' }

export default async function ServicesPage({ searchParams }: PageProps<'/servicios'>) {
  await requirePermission('services.manage')
  const sp = await searchParams
  const { categories, services, extras } = await getCatalog({ includeInactive: true })
  return (
    <>
      <PageHeader title="Servicios y precios" backHref="/mas" action={<ButtonLink href="/servicios/nuevo" size="sm" variant="soft">+ Servicio</ButtonLink>} />
      <Flash ok={sp.ok} />
      {categories.map((c) => (
        <section key={c.id}>
          <SectionTitle>{c.name}</SectionTitle>
          <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-card">
            {c.services.length === 0 && <li className="px-4 py-3 text-sm text-ink-muted">Sin servicios</li>}
            {c.services.map((s) => (
              <li key={s.id}>
                <Link href={`/servicios/${s.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-cream/60">
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate ${s.is_active ? 'font-medium' : 'text-ink-muted line-through'}`}>{s.name}</span>
                    <span className="block text-sm text-ink-muted">{formatDuration(s.duration_min)}{!s.commissionable && ' · sin comisión'}</span>
                  </span>
                  <span className="text-right tabular">
                    {s.price_is_from && <span className="block text-[11px] text-ink-muted">desde</span>}
                    {formatCOP(s.base_price)}
                  </span>
                  {!s.is_active && <Badge>Inactivo</Badge>}
                  <ChevronRight className="size-4 text-taupe" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <SectionTitle>Extras</SectionTitle>
      <Card className="py-1">
        <ExtrasManager extras={extras} categories={categories} services={services} />
      </Card>
      <SectionTitle>Categorías</SectionTitle>
      <CategoryForm />
    </>
  )
}

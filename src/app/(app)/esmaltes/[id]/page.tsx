import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { Droplet } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, SectionTitle } from '@/components/ui/card'
import { Badge, polishTone } from '@/components/ui/badge'
import { Flash } from '@/components/ui/flash'
import { PolishActions } from '@/components/esmaltes/polish-actions'
import { PolishForm } from '@/components/esmaltes/polish-form'
import { can, requireSession } from '@/lib/auth/session'
import { getPolish, polishPhotoUrl } from '@/lib/data/polishes'
import { POLISH_STATUS, POLISH_TYPES } from '@/lib/domain/labels'
import { formatShortDate, formatTime, toLocalDate, todayLocal } from '@/lib/domain/dates'

export const metadata: Metadata = { title: 'Esmalte' }

export default async function PolishPage({ params, searchParams }: PageProps<'/esmaltes/[id]'>) {
  const [{ id }, sp, session] = await Promise.all([params, searchParams, requireSession()])
  const data = await getPolish(id)
  if (!data) notFound()
  const { polish: p, history } = data
  const photo = polishPhotoUrl(p.photo_path)
  const manage = can(session, 'polishes.manage')
  const canReport = manage || can(session, 'polishes.report')

  return (
    <>
      <PageHeader title={p.color_name} subtitle={`${p.brand} · ${p.code}`} backHref="/esmaltes" />
      <Flash ok={sp.ok} />
      <Card className="space-y-4">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt={p.color_name} className="h-56 w-full rounded-2xl object-cover" />
        ) : (
          <div className="grid h-32 place-items-center rounded-2xl bg-cream"><Droplet className="size-10 text-taupe" strokeWidth={1.2} /></div>
        )}
        <div className="flex items-center justify-between">
          <div className="text-sm text-ink-soft">
            <p>{POLISH_TYPES[p.polish_type]}{p.reference && ` · Ref. ${p.reference}`}</p>
            <p className="text-ink-muted">Ingresó {formatShortDate(p.received_at)}</p>
          </div>
          <Badge tone={polishTone[p.status]}>{POLISH_STATUS[p.status]}</Badge>
        </div>
        {p.notes && <p className="text-sm text-ink-soft">{p.notes}</p>}
        {canReport && (p.status !== 'dado_de_baja' || manage) && (
          <PolishActions polishId={p.id} current={p.status} extra={manage ? ['activo', 'en_uso', 'dado_de_baja'] : ['en_uso']} />
        )}
      </Card>

      <SectionTitle>Historial</SectionTitle>
      <ol className="relative space-y-3 border-l border-line pl-5">
        {history.map((h) => (
          <li key={h.id} className="text-sm">
            <span className="absolute -left-[5px] mt-1.5 size-2.5 rounded-full bg-taupe" />
            <p>
              {h.from_status ? <>{POLISH_STATUS[h.from_status]} → </> : null}
              <strong className="font-medium">{POLISH_STATUS[h.to_status]}</strong>
            </p>
            <p className="text-ink-muted">
              {formatShortDate(toLocalDate(h.changed_at))} {formatTime(h.changed_at)}
              {h.profiles?.full_name && ` · ${h.profiles.full_name}`}
            </p>
            {(h.reason || h.comment) && <p className="text-ink-soft">{[h.reason, h.comment].filter(Boolean).join(' — ')}</p>}
          </li>
        ))}
      </ol>

      {manage && (
        <>
          <SectionTitle>Editar esmalte</SectionTitle>
          <Card><PolishForm polish={p} photoUrl={photo} today={todayLocal()} /></Card>
        </>
      )}
    </>
  )
}

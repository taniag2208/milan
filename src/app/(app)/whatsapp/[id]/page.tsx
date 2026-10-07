import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/components/ui/cn'
import { ConversationControls } from '@/components/whatsapp/conversation-controls'
import { requirePermission } from '@/lib/auth/session'
import { getConversation } from '@/lib/data/whatsapp'
import { canSend } from '@/lib/integrations/whatsapp/config'
import { CONVERSATION_MODES } from '@/lib/domain/labels'
import { formatPhone } from '@/lib/domain/phone'
import { formatShortDate, formatTime, toLocalDate } from '@/lib/domain/dates'

export const metadata: Metadata = { title: 'Conversación' }

const STATUS: Record<string, string> = { queued: 'En cola', sent: 'Enviado', delivered: 'Entregado', read: 'Leído', failed: 'Falló', received: '' }

export default async function ConversationPage({ params }: PageProps<'/whatsapp/[id]'>) {
  await requirePermission('whatsapp.manage')
  const { id } = await params
  const data = await getConversation(id)
  if (!data) notFound()
  const { conversation: c, messages } = data
  const contact = c.whatsapp_contacts
  return (
    <div className="lg:mx-auto lg:max-w-3xl">
      <PageHeader
        title={contact?.customers?.full_name ?? contact?.profile_name ?? 'Contacto'}
        subtitle={formatPhone(contact?.phone_e164)}
        backHref="/whatsapp"
        action={<Badge tone={c.mode === 'HUMAN_ACTIVE' ? 'dark' : 'info'}>{CONVERSATION_MODES[c.mode]}</Badge>}
      />
      {contact?.customers && (
        <Link href={`/clientes/${contact.customers.id}`} className="mb-3 block text-sm text-almond-deep">Ver ficha de la clienta →</Link>
      )}
      {c.mode === 'HUMAN_ACTIVE' && c.taken_at && (
        <p className="mb-3 text-xs text-ink-muted">Tomada el {formatShortDate(toLocalDate(c.taken_at))} a las {formatTime(c.taken_at)}. El agente no responde mientras esté en manos de una persona.</p>
      )}
      <div className="mb-4 space-y-2">
        {messages.length === 0 && <Card className="text-sm text-ink-muted">Sin mensajes.</Card>}
        {messages.map((m) => (
          <div key={m.id} className={cn('flex', m.direction === 'outbound' ? 'justify-end' : 'justify-start')}>
            <div className={cn(
              'max-w-[80%] rounded-2xl px-3.5 py-2 text-[15px]',
              m.sender === 'system' ? 'bg-transparent text-center text-xs text-ink-muted' :
              m.direction === 'outbound' ? 'bg-ink text-cream' : 'border border-line bg-card',
            )}>
              <p className="whitespace-pre-line">{m.body}</p>
              {m.sender !== 'system' && (
                <p className={cn('mt-1 text-[11px]', m.direction === 'outbound' ? 'text-cream/60' : 'text-ink-muted')}>
                  {formatTime(m.created_at)}{m.sender === 'agent' && ' · agente'}{m.direction === 'outbound' && STATUS[m.status] && ` · ${STATUS[m.status]}`}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
      <ConversationControls id={c.id} mode={c.mode} canSend={canSend()} />
    </div>
  )
}

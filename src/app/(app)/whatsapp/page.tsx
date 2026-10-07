import Link from 'next/link'
import type { Metadata } from 'next'
import { MessageCircle } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Alert } from '@/components/ui/alert'
import { requirePermission } from '@/lib/auth/session'
import { listConversations } from '@/lib/data/whatsapp'
import { canReceive, canSend } from '@/lib/integrations/whatsapp/config'
import { CONVERSATION_MODES } from '@/lib/domain/labels'
import { formatPhone } from '@/lib/domain/phone'
import { formatShortDate, formatTime, toLocalDate } from '@/lib/domain/dates'

export const metadata: Metadata = { title: 'WhatsApp' }

export default async function WhatsappPage() {
  await requirePermission('whatsapp.manage')
  const conversations = await listConversations()
  const configured = canReceive() && canSend()
  return (
    <>
      <PageHeader title="WhatsApp" subtitle="Conversaciones" backHref="/mas" />
      {!configured && (
        <Alert tone="warning" className="mb-4">
          La integración oficial (WhatsApp Cloud API de Meta) está preparada pero sin credenciales. Configura las variables
          WHATSAPP_* y META_APP_SECRET en Vercel para activarla. El agente automático aún no responde.
        </Alert>
      )}
      {conversations.length === 0 ? (
        <EmptyState icon={<MessageCircle className="size-8" strokeWidth={1.3} />} title="Sin conversaciones" description="Los mensajes que lleguen al número de WhatsApp Business aparecerán aquí." />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-card">
          {conversations.map((c) => (
            <li key={c.id}>
              <Link href={`/whatsapp/${c.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-cream/60">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{c.whatsapp_contacts?.customers?.full_name ?? c.whatsapp_contacts?.profile_name ?? 'Contacto'}</span>
                  <span className="block text-sm text-ink-muted">
                    {formatPhone(c.whatsapp_contacts?.phone_e164)}
                    {c.last_message_at && ` · ${formatShortDate(toLocalDate(c.last_message_at), false)} ${formatTime(c.last_message_at)}`}
                  </span>
                </span>
                <Badge tone={c.mode === 'HUMAN_ACTIVE' ? 'dark' : c.mode === 'AI_ACTIVE' ? 'info' : 'neutral'}>{CONVERSATION_MODES[c.mode]}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

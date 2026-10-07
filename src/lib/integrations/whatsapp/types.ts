/** Subconjunto tipado del payload de webhooks de WhatsApp Cloud API. */
export interface WebhookPayload {
  object: string
  entry?: {
    id: string
    changes?: { field: string; value: ChangeValue }[]
  }[]
}

export interface ChangeValue {
  messaging_product?: 'whatsapp'
  metadata?: { display_phone_number: string; phone_number_id: string }
  contacts?: { wa_id: string; profile?: { name?: string } }[]
  messages?: InboundMessage[]
  statuses?: MessageStatus[]
  errors?: unknown[]
}

export interface InboundMessage {
  id: string
  from: string
  timestamp: string
  type: string
  text?: { body: string }
  image?: { id: string; caption?: string; mime_type?: string }
  button?: { text: string; payload?: string }
  interactive?: { button_reply?: { id: string; title: string }; list_reply?: { id: string; title: string } }
  [key: string]: unknown
}

export interface MessageStatus {
  id: string
  status: 'sent' | 'delivered' | 'read' | 'failed'
  timestamp: string
  recipient_id: string
  errors?: { code: number; title: string; message?: string }[]
}

export interface ParsedInbound {
  waMessageId: string
  waId: string
  profileName: string | null
  type: string
  body: string | null
  timestamp: Date
  raw: InboundMessage
}

export interface ParsedStatus {
  waMessageId: string
  status: MessageStatus['status']
  timestamp: Date
  errors: MessageStatus['errors'] | null
}

import 'server-only'
import type { ParsedInbound } from '../types'
import type { WhatsAppService } from '../service'

export interface InboundContext {
  conversationId: string
  customerId: string | null
  phone: string
  message: ParsedInbound
}

/**
 * Contrato del agente conversacional. Se invoca solo con conversaciones
 * AI_ACTIVE. Una implementación futura (LLM + AgentTools) debe:
 *  - consultar disponibilidad con AgentTools.getAvailableSlots antes de ofrecer horarios;
 *  - crear citas como "pendiente" (sin decisiones irreversibles automáticas);
 *  - escalar con service.handoffToHuman cuando no esté segura.
 */
export interface ConversationAgent {
  onInboundMessage(ctx: InboundContext, service: WhatsAppService): Promise<void>
}

/** Agente por defecto: NO responde automáticamente (fase de preparación). */
class SilentAgent implements ConversationAgent {
  async onInboundMessage(): Promise<void> {
    // Intencionalmente vacío: las respuestas automáticas aún no están habilitadas.
  }
}

let agent: ConversationAgent = new SilentAgent()

export function getAgent(): ConversationAgent {
  return agent
}

/** Punto de extensión para registrar el agente real cuando se implemente. */
export function setAgent(next: ConversationAgent) {
  agent = next
}

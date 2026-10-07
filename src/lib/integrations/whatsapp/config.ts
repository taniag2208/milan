import 'server-only'

/** Configuración de WhatsApp Cloud API (Meta). Valores solo desde variables de entorno. */
export function whatsappConfig() {
  return {
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? '',
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID ?? '',
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN ?? '',
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN ?? '',
    appSecret: process.env.META_APP_SECRET ?? '',
    graphVersion: process.env.WHATSAPP_GRAPH_API_VERSION || 'v21.0',
  }
}

/** ¿Se puede enviar mensajes? (requiere número y token). */
export function canSend(): boolean {
  const c = whatsappConfig()
  return Boolean(c.phoneNumberId && c.accessToken)
}

/** ¿Se pueden recibir webhooks de forma segura? (requiere verify token y app secret). */
export function canReceive(): boolean {
  const c = whatsappConfig()
  return Boolean(c.verifyToken && c.appSecret)
}

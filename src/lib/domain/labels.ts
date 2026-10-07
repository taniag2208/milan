/** Etiquetas en español para valores almacenados en la base. */

export const APPOINTMENT_STATUS = {
  pendiente: 'Pendiente',
  confirmada: 'Confirmada',
  en_servicio: 'En servicio',
  finalizada: 'Finalizada',
  cancelada: 'Cancelada',
  no_asistio: 'No asistió',
} as const
export type AppointmentStatus = keyof typeof APPOINTMENT_STATUS

export const CHANNELS = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  presencial: 'Presencial',
  referido: 'Referido',
  otro: 'Otro',
} as const
export type Channel = keyof typeof CHANNELS

export const POLISH_STATUS = {
  activo: 'Activo',
  en_uso: 'En uso',
  por_acabarse: 'Por acabarse',
  terminado: 'Terminado',
  danado: 'Dañado',
  perdido: 'Perdido',
  dado_de_baja: 'Dado de baja',
} as const
export type PolishStatus = keyof typeof POLISH_STATUS

export const POLISH_TYPES = {
  semipermanente: 'Semipermanente',
  tradicional: 'Tradicional',
  gel: 'Gel',
  otro: 'Otro',
} as const
export type PolishType = keyof typeof POLISH_TYPES

export const STOCK_STATUS = {
  disponible: 'Disponible',
  stock_bajo: 'Stock bajo',
  agotado: 'Agotado',
} as const
export type StockStatus = keyof typeof STOCK_STATUS

export const MOVEMENT_TYPES = {
  entrada: 'Entrada',
  salida: 'Salida',
  ajuste: 'Ajuste',
  perdida: 'Pérdida',
  dano: 'Daño',
} as const
export type MovementType = keyof typeof MOVEMENT_TYPES

export const CUSTOMER_STATUS = {
  activa: 'Activa',
  inactiva: 'Inactiva',
  bloqueada: 'Bloqueada',
} as const
export type CustomerStatus = keyof typeof CUSTOMER_STATUS

export const SEGMENTS = {
  nueva: 'Nueva',
  recurrente: 'Recurrente',
  vip: 'VIP',
  inactiva: 'Inactiva',
  por_reactivar: 'Por reactivar',
  cumpleanos_proximo: 'Cumpleaños próximo',
} as const
export type Segment = keyof typeof SEGMENTS

export const CONVERSATION_MODES = {
  AI_ACTIVE: 'Agente',
  HUMAN_ACTIVE: 'Humano',
  CLOSED: 'Cerrada',
} as const
export type ConversationMode = keyof typeof CONVERSATION_MODES

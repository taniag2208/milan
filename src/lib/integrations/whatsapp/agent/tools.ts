import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizePhone } from '@/lib/domain/phone'
import { localDayStartISO } from '@/lib/domain/dates'

/**
 * Herramientas internas para un futuro agente de WhatsApp. Todas consultan la
 * base (nunca inventan precios ni disponibilidad) y reutilizan las mismas RPC
 * y validaciones de la app.
 */
export class AgentTools {
  private db = createAdminClient()

  async getServices() {
    const { data } = await this.db
      .from('services')
      .select('id, name, base_price, price_is_from, duration_min, description, service_categories(name)')
      .eq('is_active', true)
      .order('sort_order')
    return data ?? []
  }

  async getServicePrice(serviceName: string) {
    const { data } = await this.db
      .from('services')
      .select('id, name, base_price, price_is_from, duration_min')
      .eq('is_active', true)
      .ilike('name', `%${serviceName.replace(/[%,()]/g, ' ')}%`)
      .limit(5)
    return data ?? []
  }

  /** Horarios realmente libres (consulta get_available_slots). */
  async getAvailableSlots(date: string, serviceIds: string[], staffId?: string) {
    const { data, error } = await this.db.rpc('get_available_slots', {
      p_date: date,
      p_service_ids: serviceIds,
      p_staff_id: staffId ?? null,
    })
    if (error) throw error
    return (data ?? []) as { staff_id: string; staff_name: string; starts_at: string; ends_at: string }[]
  }

  async getCustomerByPhone(phone: string) {
    const normalized = normalizePhone(phone)
    if (!normalized) return null
    const { data } = await this.db.from('customers').select('id, full_name, phone_e164, notes').eq('phone_e164', normalized).maybeSingle()
    return data
  }

  /** Historial resumido (solo cuando sea apropiado compartirlo con la clienta). */
  async getCustomerHistory(customerId: string, limit = 5) {
    const { data } = await this.db
      .from('sales')
      .select('sold_at, total, sale_items(description, kind)')
      .eq('customer_id', customerId)
      .eq('status', 'registrada')
      .order('sold_at', { ascending: false })
      .limit(limit)
    return data ?? []
  }

  async getUpcomingAppointments(customerId: string) {
    const { data } = await this.db
      .from('appointments')
      .select('id, starts_at, status, staff(display_name), appointment_services(services(name))')
      .eq('customer_id', customerId)
      .in('status', ['pendiente', 'confirmada'])
      .gte('starts_at', localDayStartISO(new Date().toISOString().slice(0, 10)))
      .order('starts_at')
    return data ?? []
  }

  async createAppointment(input: {
    phone: string; name: string; staffId: string; startsAtISO: string; serviceIds: string[]; designNotes?: string
  }) {
    const { data, error } = await this.db.rpc('create_appointment', {
      p_staff_id: input.staffId,
      p_starts_at: input.startsAtISO,
      p_service_ids: input.serviceIds,
      p_customer_phone: input.phone,
      p_customer_name: input.name,
      p_channel: 'whatsapp',
      p_design_notes: input.designNotes ?? null,
      p_status: 'pendiente',
    })
    if (error) throw error
    return data as string
  }

  async confirmAppointment(appointmentId: string) {
    const { error } = await this.db.rpc('set_appointment_status', { p_appointment_id: appointmentId, p_status: 'confirmada' })
    if (error) throw error
  }

  async rescheduleAppointment(appointmentId: string, staffId: string, startsAtISO: string, serviceIds: string[]) {
    const { error } = await this.db.rpc('update_appointment', {
      p_appointment_id: appointmentId,
      p_staff_id: staffId,
      p_starts_at: startsAtISO,
      p_service_ids: serviceIds,
      p_channel: 'whatsapp',
    })
    if (error) throw error
  }

  async cancelAppointment(appointmentId: string, reason: string) {
    const { error } = await this.db.rpc('set_appointment_status', {
      p_appointment_id: appointmentId,
      p_status: 'cancelada',
      p_reason: `WhatsApp: ${reason}`,
    })
    if (error) throw error
  }

  async getBusinessInfo() {
    const { data } = await this.db.from('business_settings').select('key, value').in('key', ['business', 'opening_hours'])
    return Object.fromEntries((data ?? []).map((r) => [r.key, r.value]))
  }
}

/** Definiciones (JSON Schema) para exponer las herramientas a un modelo en el futuro. */
export const AGENT_TOOL_DEFINITIONS = [
  { name: 'getServices', description: 'Lista servicios activos con precio y duración.', input_schema: { type: 'object', properties: {} } },
  { name: 'getServicePrice', description: 'Busca el precio de un servicio por nombre.', input_schema: { type: 'object', properties: { serviceName: { type: 'string' } }, required: ['serviceName'] } },
  { name: 'getAvailableSlots', description: 'Horarios libres reales para una fecha (YYYY-MM-DD) y servicios.', input_schema: { type: 'object', properties: { date: { type: 'string' }, serviceIds: { type: 'array', items: { type: 'string' } }, staffId: { type: 'string' } }, required: ['date', 'serviceIds'] } },
  { name: 'getCustomerByPhone', description: 'Identifica a la clienta por teléfono.', input_schema: { type: 'object', properties: { phone: { type: 'string' } }, required: ['phone'] } },
  { name: 'createAppointment', description: 'Crea una cita PENDIENTE (requiere confirmación humana o de la clienta).', input_schema: { type: 'object', properties: { phone: { type: 'string' }, name: { type: 'string' }, staffId: { type: 'string' }, startsAtISO: { type: 'string' }, serviceIds: { type: 'array', items: { type: 'string' } }, designNotes: { type: 'string' } }, required: ['phone', 'name', 'staffId', 'startsAtISO', 'serviceIds'] } },
  { name: 'rescheduleAppointment', description: 'Reprograma una cita existente.', input_schema: { type: 'object', properties: { appointmentId: { type: 'string' }, staffId: { type: 'string' }, startsAtISO: { type: 'string' }, serviceIds: { type: 'array', items: { type: 'string' } } }, required: ['appointmentId', 'staffId', 'startsAtISO', 'serviceIds'] } },
  { name: 'cancelAppointment', description: 'Cancela una cita indicando el motivo.', input_schema: { type: 'object', properties: { appointmentId: { type: 'string' }, reason: { type: 'string' } }, required: ['appointmentId', 'reason'] } },
  { name: 'handoffToHuman', description: 'Escala la conversación a una persona del spa.', input_schema: { type: 'object', properties: { reason: { type: 'string' } }, required: ['reason'] } },
] as const

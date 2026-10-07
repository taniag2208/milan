/**
 * Tipos de filas de la base de datos (espejo de supabase/migrations).
 * Si cambias una migración, actualiza aquí. Cuando haya acceso a la CLI de
 * Supabase se pueden reemplazar por `supabase gen types typescript`.
 */
import type {
  AppointmentStatus, Channel, ConversationMode, CustomerStatus, MovementType,
  PolishStatus, PolishType, Segment, StockStatus,
} from '@/lib/domain/labels'

export type UUID = string
export type Timestamp = string

export interface Role { id: UUID; key: string; name: string; description: string | null; is_admin: boolean }
export interface Profile {
  id: UUID; username: string; full_name: string; role_id: UUID; is_active: boolean
  created_at: Timestamp; updated_at: Timestamp
}
export interface Staff {
  id: UUID; profile_id: UUID | null; display_name: string; phone: string | null
  color: string; is_active: boolean; sort_order: number
}
export interface PaymentMethod { id: UUID; name: string; is_active: boolean; sort_order: number }
export interface ServiceCategory { id: UUID; name: string; sort_order: number; is_active: boolean }
export interface Service {
  id: UUID; category_id: UUID; name: string; description: string | null
  base_price: number; price_is_from: boolean; duration_min: number
  commissionable: boolean; is_active: boolean; sort_order: number
}
export interface ServiceExtra {
  id: UUID; name: string; price: number; service_id: UUID | null; category_id: UUID | null
  commissionable: boolean; is_active: boolean; sort_order: number
}
export interface Customer {
  id: UUID; full_name: string; phone_e164: string | null; birth_date: string | null
  instagram: string | null; source: Channel; notes: string | null; status: CustomerStatus
  marketing_consent: boolean; marketing_consent_at: Timestamp | null
  created_at: Timestamp; updated_at: Timestamp
}
export interface CustomerStats {
  customer_id: UUID; first_visit_at: Timestamp | null; last_visit_at: Timestamp | null
  visits: number; total_spent: number; favorite_service: string | null; usual_staff: string | null
}
export interface CustomerSegments { customer_id: UUID; segments: Segment[] }
export interface Appointment {
  id: UUID; customer_id: UUID; staff_id: UUID; starts_at: Timestamp; ends_at: Timestamp
  status: AppointmentStatus; channel: Channel; notes: string | null; design_notes: string | null
  reference_image_path: string | null; started_at: Timestamp | null; finished_at: Timestamp | null
  cancelled_at: Timestamp | null; cancel_reason: string | null; created_at: Timestamp
}
export interface AppointmentService {
  id: UUID; appointment_id: UUID; service_id: UUID; price: number; duration_min: number; sort_order: number
}
export interface Sale {
  id: UUID; appointment_id: UUID | null; customer_id: UUID | null; staff_id: UUID; sold_at: Timestamp
  services_total: number; extras_total: number; discount: number; total: number
  payment_method_id: UUID; status: 'registrada' | 'anulada'; notes: string | null
  void_reason: string | null; voided_at: Timestamp | null; created_by: UUID | null
}
export interface SaleItem {
  id: UUID; sale_id: UUID; kind: 'servicio' | 'extra'; service_id: UUID | null; extra_id: UUID | null
  description: string; list_price: number; unit_price: number; quantity: number; line_total: number
  commissionable: boolean
}
export interface CommissionRule { id: UUID; staff_id: UUID; percent: number; effective_from: Timestamp }
export interface CommissionRecord {
  id: UUID; sale_id: UUID; staff_id: UUID; base_amount: number; percent: number
  commission_amount: number; business_amount: number; status: 'pendiente' | 'pagada' | 'anulada'
  paid_at: Timestamp | null; created_at: Timestamp
}
export interface CommissionSummaryRow {
  staff_id: UUID; staff_name: string; sales_count: number; total_sold: number; base_amount: number
  commission_amount: number; business_amount: number; pending_amount: number; current_percent: number
}
export interface InventoryItem {
  id: UUID; name: string; category: string; unit: string; quantity: number; min_stock: number
  supplier: string | null; unit_cost: number | null; is_active: boolean; stock_status: StockStatus
  updated_at: Timestamp
}
export interface InventoryMovement {
  id: UUID; item_id: UUID; movement_type: MovementType; quantity: number; delta: number
  quantity_before: number; quantity_after: number; reason: string | null; note: string | null
  created_by: UUID | null; created_at: Timestamp
}
export interface NailPolish {
  id: UUID; code: string; brand: string; color_name: string; reference: string | null
  polish_type: PolishType; photo_path: string | null; received_at: string; status: PolishStatus
  notes: string | null; created_at: Timestamp
}
export interface NailPolishHistory {
  id: UUID; polish_id: UUID; from_status: PolishStatus | null; to_status: PolishStatus
  reason: string | null; comment: string | null; changed_by: UUID | null; changed_at: Timestamp
}
export interface WhatsappContact {
  id: UUID; wa_id: string; phone_e164: string; profile_name: string | null; customer_id: UUID | null
}
export interface WhatsappConversation {
  id: UUID; contact_id: UUID; mode: ConversationMode; assigned_to: UUID | null
  taken_at: Timestamp | null; last_message_at: Timestamp | null; created_at: Timestamp
}
export interface WhatsappMessage {
  id: UUID; conversation_id: UUID; wa_message_id: string | null; direction: 'inbound' | 'outbound'
  sender: 'customer' | 'agent' | 'human' | 'system'; message_type: string; body: string | null
  payload: unknown; status: 'received' | 'queued' | 'sent' | 'delivered' | 'read' | 'failed'
  error: unknown; sent_by: UUID | null; wa_timestamp: Timestamp | null; created_at: Timestamp
}
export interface AuditLog {
  id: UUID; actor_id: UUID | null; action: string; entity: string; entity_id: string | null
  metadata: Record<string, unknown>; created_at: Timestamp
}

export type OpeningHours = Record<'1' | '2' | '3' | '4' | '5' | '6' | '7', { open: string; close: string } | null>

export interface BusinessInfo {
  name: string; address: string | null; phone: string | null; instagram: string | null
  timezone: string; currency: string
}

export interface CrmRules {
  new_max_visits: number; recurring_min_visits: number; vip_window_days: number
  vip_min_spent: number; vip_min_visits: number; inactive_days: number
  reactivation_default_days: number; reactivation_days: Record<string, number>
  birthday_window_days: number
}

export interface DashboardSummary {
  sales_total: number; sales_count: number; today_sales_total: number; month_sales_total: number
  appointments: { total: number; pendientes: number; atendidas: number; canceladas: number }
  next_appointment: { id: UUID; starts_at: Timestamp; customer: string; staff: string; services: string | null } | null
  customers: { nuevas: number; recurrentes: number }
  top_services: { name: string; count: number; total: number }[]
  sales_by_staff: { name: string; count: number; total: number }[]
  payment_methods: { name: string; count: number; total: number }[]
  pending_commissions: number
  inventory_alerts: Pick<InventoryItem, 'id' | 'name' | 'quantity' | 'unit' | 'min_stock' | 'stock_status'>[]
  polishes: { por_acabarse: number; terminado: number; danado: number; perdido: number }
}

export interface CompleteAppointmentResult {
  sale_id: UUID; total: number; payment_method: string; commission_amount: number; commission_percent: number
}

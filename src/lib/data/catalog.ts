import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { PaymentMethod, Service, ServiceCategory, ServiceExtra, Staff } from '@/lib/types/db'

export type CatalogCategory = ServiceCategory & { services: Service[] }

export const getCatalog = cache(async (opts: { includeInactive?: boolean } = {}) => {
  const supabase = await createClient()
  let servicesQuery = supabase.from('services').select('*').order('sort_order').order('name')
  if (!opts.includeInactive) servicesQuery = servicesQuery.eq('is_active', true)
  const [{ data: categories }, { data: services }, { data: extras }] = await Promise.all([
    supabase.from('service_categories').select('*').order('sort_order').returns<ServiceCategory[]>(),
    servicesQuery.returns<Service[]>(),
    supabase.from('service_extras').select('*').order('sort_order').order('name').returns<ServiceExtra[]>(),
  ])
  const grouped: CatalogCategory[] = (categories ?? []).map((c) => ({
    ...c,
    services: (services ?? []).filter((s) => s.category_id === c.id),
  }))
  return {
    categories: grouped.filter((c) => opts.includeInactive || (c.is_active && c.services.length > 0)),
    services: services ?? [],
    extras: (extras ?? []).filter((e) => opts.includeInactive || e.is_active),
  }
})

export const getPaymentMethods = cache(async (includeInactive = false) => {
  const supabase = await createClient()
  let q = supabase.from('payment_methods').select('*').order('sort_order')
  if (!includeInactive) q = q.eq('is_active', true)
  const { data } = await q.returns<PaymentMethod[]>()
  return data ?? []
})

export const getStaff = cache(async (includeInactive = false) => {
  const supabase = await createClient()
  let q = supabase.from('staff').select('*').order('sort_order').order('display_name')
  if (!includeInactive) q = q.eq('is_active', true)
  const { data } = await q.returns<Staff[]>()
  return data ?? []
})

/** Extras aplicables a un conjunto de servicios (por servicio, categoría o generales). */
export function extrasForServices(extras: ServiceExtra[], services: Service[]): ServiceExtra[] {
  const serviceIds = new Set(services.map((s) => s.id))
  const categoryIds = new Set(services.map((s) => s.category_id))
  return extras.filter(
    (e) =>
      (e.service_id && serviceIds.has(e.service_id)) ||
      (e.category_id && categoryIds.has(e.category_id)) ||
      (!e.service_id && !e.category_id),
  )
}

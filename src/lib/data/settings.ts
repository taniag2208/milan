import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { BusinessInfo, CrmRules, OpeningHours } from '@/lib/types/db'

export interface Settings {
  business: BusinessInfo
  opening_hours: OpeningHours
  agenda: { slot_minutes: number }
  commission: { base: 'neto' | 'bruto' }
  crm_rules: CrmRules
}

export const getSettings = cache(async (): Promise<Settings> => {
  const supabase = await createClient()
  const { data } = await supabase.from('business_settings').select('key, value')
  const map = Object.fromEntries((data ?? []).map((r: { key: string; value: unknown }) => [r.key, r.value]))
  return {
    business: map.business ?? { name: 'MILAN', address: null, phone: null, instagram: null, timezone: 'America/Bogota', currency: 'COP' },
    opening_hours: map.opening_hours ?? {},
    agenda: map.agenda ?? { slot_minutes: 30 },
    commission: map.commission ?? { base: 'neto' },
    crm_rules: map.crm_rules ?? {},
  } as Settings
})

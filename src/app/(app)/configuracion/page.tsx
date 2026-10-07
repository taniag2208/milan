import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui/page-header'
import { Card, SectionTitle } from '@/components/ui/card'
import { BusinessForm, CrmRulesForm, HoursForm, OperationsForm, PaymentMethodsForm } from '@/components/configuracion/settings-forms'
import { requirePermission } from '@/lib/auth/session'
import { getSettings } from '@/lib/data/settings'
import { getCatalog, getPaymentMethods } from '@/lib/data/catalog'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Configuración' }

export default async function SettingsPage() {
  await requirePermission('settings.manage')
  const supabase = await createClient()
  const [settings, methods, catalog, { data: perm }] = await Promise.all([
    getSettings(),
    getPaymentMethods(true),
    getCatalog({ includeInactive: true }),
    supabase.from('role_permissions').select('permission_key, roles!inner(key)').eq('roles.key', 'colaboradora').eq('permission_key', 'appointments.create'),
  ])
  return (
    <>
      <PageHeader title="Configuración" backHref="/mas" />
      <SectionTitle>Negocio</SectionTitle>
      <Card><BusinessForm business={settings.business} /></Card>
      <SectionTitle>Horario de atención</SectionTitle>
      <Card><HoursForm hours={settings.opening_hours} /></Card>
      <SectionTitle>Agenda y comisiones</SectionTitle>
      <Card>
        <OperationsForm slotMinutes={settings.agenda.slot_minutes} commissionBase={settings.commission.base} staffCanCreate={(perm ?? []).length > 0} />
      </Card>
      <SectionTitle>Medios de pago</SectionTitle>
      <Card className="py-1"><PaymentMethodsForm methods={methods} /></Card>
      <SectionTitle>Reglas CRM</SectionTitle>
      <Card><CrmRulesForm rules={settings.crm_rules} categories={catalog.categories.map((c) => c.name)} /></Card>
    </>
  )
}

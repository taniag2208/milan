import { can, canViewCommissions, canViewSales, type AppSession } from './session'

export type NavIcon =
  | 'home' | 'calendar' | 'users' | 'receipt' | 'percent' | 'package' | 'droplet'
  | 'scissors' | 'team' | 'settings' | 'message' | 'shield'

export interface NavItem { href: string; label: string; icon: NavIcon }
export interface NavSection { title?: string; items: NavItem[] }

/** Menú según permisos: una sola fuente para el menú lateral (escritorio) y "Más" (celular). */
export function navigationFor(session: AppSession): NavSection[] {
  const operation: NavItem[] = []
  if (canViewSales(session)) operation.push({ href: '/ventas', label: can(session, 'sales.read_all') ? 'Ventas y caja' : 'Mis ventas', icon: 'receipt' })
  if (canViewCommissions(session)) operation.push({ href: '/comisiones', label: 'Comisiones', icon: 'percent' })
  operation.push({ href: '/inventario', label: 'Inventario', icon: 'package' })
  operation.push({ href: '/esmaltes', label: 'Esmaltes', icon: 'droplet' })

  const admin: NavItem[] = []
  if (can(session, 'services.manage')) admin.push({ href: '/servicios', label: 'Servicios y precios', icon: 'scissors' })
  if (can(session, 'users.manage')) admin.push({ href: '/equipo', label: 'Equipo y usuarios', icon: 'team' })
  if (can(session, 'settings.manage')) admin.push({ href: '/configuracion', label: 'Configuración', icon: 'settings' })
  if (can(session, 'whatsapp.manage')) admin.push({ href: '/whatsapp', label: 'WhatsApp', icon: 'message' })
  if (can(session, 'audit.read')) admin.push({ href: '/auditoria', label: 'Auditoría', icon: 'shield' })

  return [
    { items: [
      { href: '/inicio', label: 'Inicio', icon: 'home' },
      { href: '/agenda', label: 'Agenda', icon: 'calendar' },
      { href: '/clientes', label: 'Clientes', icon: 'users' },
    ] },
    { title: 'Operación', items: operation },
    ...(admin.length ? [{ title: 'Administración', items: admin }] : []),
  ]
}

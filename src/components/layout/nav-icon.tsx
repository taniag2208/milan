import {
  CalendarDays, Droplet, Home, MessageCircle, Package, Percent, Receipt, Scissors, Settings, ShieldCheck, UserCog, Users,
} from 'lucide-react'
import type { NavIcon as NavIconName } from '@/lib/auth/navigation'

const ICONS = {
  home: Home, calendar: CalendarDays, users: Users, receipt: Receipt, percent: Percent, package: Package,
  droplet: Droplet, scissors: Scissors, team: UserCog, settings: Settings, message: MessageCircle, shield: ShieldCheck,
}

export function NavIcon({ name, className, strokeWidth = 1.5 }: { name: NavIconName; className?: string; strokeWidth?: number }) {
  const Icon = ICONS[name]
  return <Icon className={className} strokeWidth={strokeWidth} />
}

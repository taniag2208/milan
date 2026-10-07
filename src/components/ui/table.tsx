import Link from 'next/link'
import type { ReactNode } from 'react'
import { cn } from './cn'

/** Tabla para escritorio (en celular se usan listas). */
export function DataTable({ head, children, className }: { head: ReactNode[]; children: ReactNode; className?: string }) {
  return (
    <div className={cn('hidden overflow-hidden rounded-[var(--radius-card)] border border-line bg-card lg:block', className)}>
      <table className="w-full text-left text-sm">
        <thead className="border-b border-line bg-cream/50 text-xs uppercase tracking-wider text-ink-muted">
          <tr>{head.map((h, i) => <th key={i} className="px-4 py-3 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  )
}

/** Fila clicable: toda la fila lleva al detalle. */
export function RowLink({ href, cells }: { href: string; cells: ReactNode[] }) {
  return (
    <tr className="group hover:bg-cream/40">
      {cells.map((c, i) => (
        <td key={i} className="p-0">
          <Link href={href} className="block px-4 py-3">{c}</Link>
        </td>
      ))}
    </tr>
  )
}

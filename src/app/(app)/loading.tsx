export default function Loading() {
  return (
    <div className="animate-pulse space-y-4 pt-20" aria-busy="true" aria-label="Cargando">
      <div className="h-8 w-40 rounded-full bg-beige/70" />
      <div className="h-28 rounded-[var(--radius-card)] bg-cream" />
      <div className="h-20 rounded-[var(--radius-card)] bg-cream" />
      <div className="h-20 rounded-[var(--radius-card)] bg-cream" />
    </div>
  )
}

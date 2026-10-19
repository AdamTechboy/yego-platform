import { NativeSelect } from '@/components/yego/fields'
import { useDB } from '@/lib/demo-store'
import { STATES, getState } from '@/lib/nigeria'
import { cn } from '@/lib/utils'

export function useActor() {
  const { session } = useDB()
  return {
    role: session?.role,
    by: session ? `${session.name} (${session.role})` : 'Unknown',
  }
}

export function StatCard({
  label,
  value,
  sub,
  tone = 'default',
}: {
  label: string
  value: string | number
  sub?: string
  tone?: 'default' | 'primary' | 'warn' | 'danger'
}) {
  return (
    <div
      className={cn(
        'rounded-lg border bg-card p-4',
        tone === 'primary' && 'border-primary/30',
        tone === 'warn' && 'border-amber-300 bg-amber-50/60',
        tone === 'danger' && 'border-red-300 bg-red-50/60',
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-black tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

export function GeoFilters({
  state,
  lga,
  onState,
  onLga,
  lockedState,
  children,
}: {
  state: string
  lga: string
  onState: (s: string) => void
  onLga: (l: string) => void
  lockedState?: string
  children?: React.ReactNode
}) {
  const lgas = getState(lockedState ?? state)?.lgas ?? []
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="w-44 text-xs font-semibold">
        State
        <NativeSelect
          className="mt-1 h-9"
          placeholder={lockedState ? undefined : 'All states + FCT'}
          options={lockedState ? [lockedState] : STATES.map((s) => s.name)}
          value={lockedState ?? state}
          disabled={!!lockedState}
          onChange={(e) => {
            onState(e.target.value)
            onLga('')
          }}
        />
      </label>
      <label className="w-48 text-xs font-semibold">
        LGA
        <NativeSelect
          className="mt-1 h-9"
          placeholder={lockedState || state ? 'All LGAs' : 'Select a state'}
          options={lgas}
          value={lga}
          disabled={!lgas.length}
          onChange={(e) => onLga(e.target.value)}
        />
      </label>
      {children}
    </div>
  )
}

export function Bar({ value, max, color = 'var(--primary)' }: { value: number; max: number; color?: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full" style={{ width: `${max ? Math.max(2, (value / max) * 100) : 0}%`, background: color }} />
    </div>
  )
}

import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Activity, AlertOctagon } from 'lucide-react'

import { NativeSelect } from '@/components/yego/fields'
import { NigeriaMap } from '@/components/yego/nigeria-map'
import { IncidentStatusBadge, SEVERITY_COLOR, SeverityBadge } from '@/components/yego/status'
import { useDB } from '@/lib/demo-store'
import { INCIDENT_STAGES, STATE_COVERAGE } from '@/lib/fixtures'
import { nf, timeAgo } from '@/lib/format'
import { TOTALS, getState } from '@/lib/nigeria'
import { Bar, GeoFilters, StatCard } from './shared'

const PENDING = ['Reported', 'Received', 'Under Review']
const RESOLVED = ['Referred/Actioned', 'Closed']
const VERIFIED = ['Verified', 'Referred/Actioned', 'Closed']

// Spread a state's Guards across its LGAs deterministically for the stub.
function lgaBreakdown(stateName: string, total: number) {
  const st = getState(stateName)
  if (!st) return []
  const weights = st.lgas.map((l, i) => 1 + ((l.length * 31 + i * 17) % 9))
  const sum = weights.reduce((a, b) => a + b, 0)
  return st.lgas.map((l, i) => ({ lga: l, guards: Math.round((weights[i] / sum) * total) }))
}

export function OverviewView({ lockedState }: { lockedState?: string }) {
  const { incidents, warnings, applications } = useDB()
  const [state, setState] = useState('')
  const [lga, setLga] = useState('')
  const [status, setStatus] = useState('')
  const s = lockedState ?? state

  const rows = s ? STATE_COVERAGE.filter((r) => r.state === s) : STATE_COVERAGE
  const sum = (k: 'registered' | 'verified' | 'trained' | 'pusCovered' | 'pollingUnits') => rows.reduce((n, r) => n + r[k], 0)
  const liveApps = applications.filter((a) => (!s || a.stateOfResidence === s) && (!lga || a.lga === lga))

  const inc = useMemo(
    () => incidents.filter((i) => (!s || i.state === s) && (!lga || i.lga === lga) && (!status || i.status === status)),
    [incidents, s, lga, status],
  )
  const ew = warnings.filter((w) => (!s || w.state === s) && (!lga || w.lga === lga))
  const feed = [...inc].sort((a, b) => b.reportedAt.localeCompare(a.reportedAt)).slice(0, 8)

  const clusters = Object.entries(
    inc.filter((i) => PENDING.includes(i.status) || i.status === 'Verified').reduce<Record<string, number>>((m, i) => {
      const k = `${i.lga}, ${i.state}`
      m[k] = (m[k] ?? 0) + 1
      return m
    }, {}),
  ).filter(([, n]) => n >= 2)

  const byState = [...STATE_COVERAGE].sort((a, b) => b.registered - a.registered)
  const maxReg = byState[0]?.registered ?? 1
  const lgaRows = s ? lgaBreakdown(s, rows[0]?.registered ?? 0).sort((a, b) => b.guards - a.guards) : []
  const maxLga = lgaRows[0]?.guards ?? 1
  const st = s ? getState(s) : undefined

  return (
    <div className="space-y-6">
      <GeoFilters state={state} lga={lga} onState={setState} onLga={setLga} lockedState={lockedState}>
        <label className="w-48 text-xs font-semibold">
          Incident status
          <NativeSelect className="mt-1 h-9" placeholder="All statuses" options={INCIDENT_STAGES} value={status} onChange={(e) => setStatus(e.target.value)} />
        </label>
      </GeoFilters>

      <section aria-label="Guards" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Registered Guards" value={nf.format(sum('registered') + liveApps.length)} sub={`${liveApps.length} applications in queue`} tone="primary" />
        <StatCard label="Verified Guards" value={nf.format(sum('verified'))} sub={`${Math.round((sum('verified') / sum('registered')) * 100)}% of registered`} />
        <StatCard label="Training completed" value={nf.format(sum('trained'))} />
        <StatCard
          label="Polling units covered"
          value={nf.format(sum('pusCovered'))}
          sub={`of ${nf.format(s ? sum('pollingUnits') : TOTALS.pollingUnits)} (${Math.round((sum('pusCovered') / (s ? sum('pollingUnits') : TOTALS.pollingUnits)) * 100)}%)`}
        />
      </section>
      <section aria-label="Incidents" className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Reported incidents" value={inc.length} />
        <StatCard label="Verified" value={inc.filter((i) => VERIFIED.includes(i.status)).length} />
        <StatCard label="Pending review" value={inc.filter((i) => PENDING.includes(i.status)).length} tone="warn" />
        <StatCard label="Resolved / referred" value={inc.filter((i) => RESOLVED.includes(i.status)).length} />
        <StatCard label="Early-warning alerts" value={ew.length} sub={`${ew.filter((w) => w.level === 'Urgent').length} urgent`} tone="danger" />
      </section>

      {clusters.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900">
          <AlertOctagon className="size-5" />
          <strong>Cluster detected:</strong>
          {clusters.map(([k, n]) => (
            <span key={k} className="rounded-full bg-white px-2 py-0.5 font-semibold">
              {k} · {n} open reports
            </span>
          ))}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-5">
        <section className="rounded-lg border bg-card xl:col-span-3">
          <div className="flex items-center justify-between border-b p-4">
            <h2 className="font-bold">Live incident map</h2>
            <span className="flex items-center gap-3 text-xs text-muted-foreground">
              {(['Low', 'Medium', 'High', 'Critical'] as const).map((k) => (
                <span key={k} className="flex items-center gap-1">
                  <span className="size-2.5 rounded-full" style={{ background: SEVERITY_COLOR[k] }} />
                  {k}
                </span>
              ))}
              <span className="flex items-center gap-1">
                <span className="size-2.5 rotate-45 bg-violet-600" /> Early warning
              </span>
            </span>
          </div>
          <NigeriaMap
            className="m-3 h-[26rem]"
            showSearch
            focus={st ? { lat: st.lat, lng: st.lng, zoom: 9 } : null}
            markers={[
              ...inc.map((i) => ({ id: i.id, lat: i.lat, lng: i.lng, color: SEVERITY_COLOR[i.severity], radius: i.severity === 'Critical' ? 10 : 7, popup: `<b>${i.type}</b><br/>${i.pollingUnit}<br/>${i.id} · ${i.status}` })),
              ...ew.map((w) => ({ id: w.id, lat: w.lat, lng: w.lng, color: '#7c3aed', radius: 9, popup: `<b>⚠ ${w.level}: ${w.title}</b><br/>${w.lga}, ${w.state}` })),
            ]}
          />
        </section>

        <section className="rounded-lg border bg-card xl:col-span-2">
          <div className="flex items-center justify-between border-b p-4">
            <h2 className="flex items-center gap-2 font-bold">
              <Activity className="size-4 text-primary" /> Incoming reports
            </h2>
            <Link to="/command" search={{ view: 'incidents' }} className="text-sm font-semibold text-primary hover:underline">
              Open queue
            </Link>
          </div>
          <ul className="divide-y">
            {feed.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">No incidents match these filters.</li>}
            {feed.map((i) => (
              <li key={i.id} className="flex items-start gap-3 p-4">
                <span className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ background: SEVERITY_COLOR[i.severity] }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{i.type}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {i.pollingUnit} · {i.lga}, {i.state}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <SeverityBadge severity={i.severity} />
                    <IncidentStatusBadge status={i.status} />
                    <span className="text-xs text-muted-foreground">{timeAgo(i.reportedAt)}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="rounded-lg border bg-card p-4 sm:p-5">
        <h2 className="font-bold">{s ? `Guards by LGA · ${s}` : 'Guards by state'}</h2>
        <p className="text-xs text-muted-foreground">{s ? `${lgaRows.length} LGAs` : 'Registered Guards and polling-unit coverage, 36 states + FCT'}</p>
        <div className="mt-4 grid gap-x-8 gap-y-2.5 md:grid-cols-2">
          {s
            ? lgaRows.map((r) => (
                <div key={r.lga} className="grid grid-cols-[9rem_1fr_3.5rem] items-center gap-3 text-sm">
                  <span className="truncate">{r.lga}</span>
                  <Bar value={r.guards} max={maxLga} />
                  <span className="text-right tabular-nums">{nf.format(r.guards)}</span>
                </div>
              ))
            : byState.map((r) => (
                <button
                  type="button"
                  key={r.state}
                  disabled={!!lockedState}
                  onClick={() => setState(r.state)}
                  className="grid grid-cols-[7rem_1fr_3.5rem_2.75rem] items-center gap-3 rounded text-left text-sm hover:bg-muted"
                >
                  <span className="truncate">{r.state}</span>
                  <Bar value={r.registered} max={maxReg} />
                  <span className="text-right tabular-nums">{nf.format(r.registered)}</span>
                  <span className="text-right text-xs tabular-nums text-muted-foreground">{Math.round((r.pusCovered / r.pollingUnits) * 100)}%</span>
                </button>
              ))}
        </div>
      </section>
    </div>
  )
}

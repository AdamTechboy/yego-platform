import { useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowRight, ExternalLink, MapPin, Search, ShieldCheck } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/yego/fields'
import { PublicShell } from '@/components/yego/site-shell'
import { STATE_COVERAGE } from '@/lib/fixtures'
import { nf } from '@/lib/format'
import { STATES, TOTALS, ZONES } from '@/lib/nigeria'

export const Route = createFileRoute('/map')({
  head: () => ({ meta: [{ title: 'Coverage map · YEGO' }] }),
  component: MapPage,
})

const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined

function googleEmbed(query: string, zoom: number) {
  const q = encodeURIComponent(query)
  if (key) {
    return `https://www.google.com/maps/embed/v1/place?key=${key}&q=${q}&zoom=${zoom}`
  }
  return `https://maps.google.com/maps?q=${q}&z=${zoom}&output=embed`
}

function googleSearch(query: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

function MapPage() {
  const [stateName, setStateName] = useState('')
  const state = STATES.find((item) => item.name === stateName)
  const coverage = STATE_COVERAGE.find((item) => item.state === stateName)

  const query = state ? `${state.name}, Nigeria` : 'Nigeria'
  const zoom = state ? 8 : 6
  const src = useMemo(() => googleEmbed(query, zoom), [query, zoom])

  const nationalCoverage = STATE_COVERAGE.reduce((sum, item) => sum + item.pusCovered, 0)
  const nationalUnits = TOTALS.pollingUnits
  const percentage = Math.round((nationalCoverage / nationalUnits) * 100)

  return (
    <PublicShell>
      <section className="bg-ink py-14 text-white md:py-20">
        <div className="mx-auto max-w-content px-4 sm:px-6">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
            <MapPin className="size-3.5" /> Coverage map
          </p>
          <h1 className="mt-5 max-w-3xl text-4xl font-black leading-tight md:text-5xl">
            Every state. Every LGA. Every polling unit we can reach.
          </h1>
          <p className="mt-4 max-w-2xl text-white/75">
            Pick a state to trace its location on Google Maps, then compare registered Guards with polling-unit coverage.
            Coordinates and polling-unit totals come from the national reference dataset; official polling-unit codes are
            imported from INEC before deployment.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              ['36 + FCT', 'States covered'],
              [nf.format(TOTALS.lgas), 'LGAs'],
              [nf.format(nationalUnits), 'Polling units'],
              [`${percentage}%`, 'PU coverage (target)'],
            ].map(([value, label]) => (
              <div key={label} className="border-t border-white/15 pt-3">
                <p className="font-display text-2xl font-black">{value}</p>
                <p className="text-xs uppercase tracking-wider text-white/60">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-10 md:py-14">
        <div className="mx-auto grid max-w-content gap-6 px-4 sm:px-6 lg:grid-cols-[340px_1fr]">
          <div className="space-y-4">
            <div className="rounded-lg border bg-card p-5">
              <label className="text-xs font-semibold">
                State
                <NativeSelect
                  className="mt-2 h-10"
                  placeholder="All Nigeria"
                  options={STATES.map((item) => item.name)}
                  value={stateName}
                  onChange={(event) => setStateName(event.target.value)}
                />
              </label>
              <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
                <Search className="mt-0.5 size-3.5 shrink-0" />
                The map uses Google Maps. Use “Open in Google Maps” for directions, satellite view and street-level tracing.
              </p>
            </div>

            {state && coverage ? (
              <div className="rounded-lg border bg-card p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-primary">{state.zone} zone</p>
                <h2 className="mt-1 text-xl font-black">{state.name}</h2>
                <p className="text-sm text-muted-foreground">
                  Capital: {state.capital} · {state.lgas.length} LGAs · {nf.format(state.wards)} wards
                </p>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Registered Guards</dt>
                    <dd className="font-display text-lg font-black">{nf.format(coverage.registered)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Verified</dt>
                    <dd className="font-display text-lg font-black">{nf.format(coverage.verified)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Trained</dt>
                    <dd className="font-display text-lg font-black">{nf.format(coverage.trained)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Polling units</dt>
                    <dd className="font-display text-lg font-black">{nf.format(state.pollingUnits)}</dd>
                  </div>
                </dl>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${Math.round((coverage.pusCovered / state.pollingUnits) * 100)}%` }}
                  />
                </div>
                <p className="mt-2 text-xs">
                  {nf.format(coverage.pusCovered)} polling units covered (target) ·{' '}
                  {Math.round((coverage.pusCovered / state.pollingUnits) * 100)}%
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline">
                    <a href={googleSearch(`${state.name}, Nigeria`)} target="_blank" rel="noopener noreferrer">
                      <ExternalLink /> Open in Google Maps
                    </a>
                  </Button>
                  <Button asChild size="sm">
                    <Link to="/apply">
                      Join in {state.name} <ArrowRight />
                    </Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border bg-card p-5">
                <p className="flex items-center gap-2 font-bold">
                  <ShieldCheck className="size-4 text-primary" /> National coverage
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Select a state to see its capitals, LGA count, polling units and Guard coverage. The national target is{' '}
                  {nf.format(nationalCoverage)} covered polling units out of {nf.format(nationalUnits)}.
                </p>
                <Button asChild size="sm" variant="outline" className="mt-4">
                  <a href={googleSearch('Nigeria')} target="_blank" rel="noopener noreferrer">
                    <ExternalLink /> Open Nigeria in Google Maps
                  </a>
                </Button>
              </div>
            )}

            <div className="rounded-lg border bg-card p-5">
              <p className="text-sm font-bold">Search a ward or polling unit</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Google Maps searches the whole country. Add “Nigeria” and the LGA name for the fastest result.
              </p>
              <Button asChild size="sm" variant="outline" className="mt-3 w-full">
                <a href={googleSearch(state ? `${state.name}, Nigeria` : 'Nigeria polling unit')} target="_blank" rel="noopener noreferrer">
                  <Search /> Search on Google Maps
                </a>
              </Button>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
              <p className="text-sm font-semibold">{state ? state.name : 'Nigeria'}</p>
              <a
                href={googleSearch(query)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                Open in Google Maps <ExternalLink className="size-3" />
              </a>
            </div>
            <iframe
              key={src}
              title={`Google Map of ${state ? state.name : 'Nigeria'}`}
              src={src}
              className="h-[420px] w-full border-0 md:h-[560px]"
              loading="lazy"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </section>

      <section className="border-t bg-card py-12 md:py-16">
        <div className="mx-auto max-w-content px-4 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-bold uppercase tracking-wider text-primary">National reach</p>
              <h2 className="mt-1 text-2xl font-black md:text-3xl">Coverage by geopolitical zone</h2>
            </div>
            <Button asChild variant="outline">
              <Link to="/apply">
                Become a Guard <ArrowRight />
              </Link>
            </Button>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ZONES.map((zone) => {
              const rows = STATE_COVERAGE.filter((item) => item.zone === zone)
              const units = rows.reduce((sum, item) => sum + item.pollingUnits, 0)
              const covered = rows.reduce((sum, item) => sum + item.pusCovered, 0)
              const pct = Math.round((covered / units) * 100)
              return (
                <div key={zone} className="rounded-lg border bg-background p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold">{zone}</h3>
                    <span className="text-xs text-muted-foreground">{rows.length} states</span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-2 text-xs">
                    <strong>{pct}%</strong> of {nf.format(units)} polling units (target)
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </PublicShell>
  )
}

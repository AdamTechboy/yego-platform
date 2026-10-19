import { useEffect, useRef, useState } from 'react'
import type * as L from 'leaflet'
import { Crosshair, Loader2, MapPin, Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NIGERIA_CENTER } from '@/lib/nigeria'
import { cn } from '@/lib/utils'

export interface MapMarker {
  id: string
  lat: number
  lng: number
  color: string
  radius?: number
  popup?: string
}

export interface PickedPoint {
  lat: number
  lng: number
  label?: string
}

interface Props {
  markers?: MapMarker[]
  picked?: PickedPoint | null
  onPick?: (p: PickedPoint) => void
  focus?: { lat: number; lng: number; zoom: number } | null
  className?: string
  showSearch?: boolean
  onMarkerClick?: (id: string) => void
}

// Nigeria bounding box, used to keep geocoding and panning in-country.
const NG_BOUNDS: [[number, number], [number, number]] = [
  [3.9, 2.6],
  [14.0, 14.8],
]

export function NigeriaMap({
  markers = [],
  picked,
  onPick,
  focus,
  className,
  showSearch = true,
  onMarkerClick,
}: Props) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const lib = useRef<typeof L | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)
  const pin = useRef<L.Marker | null>(null)
  const [ready, setReady] = useState(false)
  const onPickRef = useRef(onPick)
  const onMarkerRef = useRef(onMarkerClick)
  useEffect(() => {
    onPickRef.current = onPick
    onMarkerRef.current = onMarkerClick
  })

  useEffect(() => {
    let cancelled = false
    import('leaflet').then((mod) => {
      const Lf = (mod.default ?? mod) as typeof L
      if (cancelled || !el.current || map.current) return
      lib.current = Lf
      const m = Lf.map(el.current, {
        center: NIGERIA_CENTER,
        zoom: 6,
        minZoom: 5,
        maxBounds: [
          [2.5, 1.0],
          [15.5, 16.5],
        ],
        zoomControl: true,
        preferCanvas: true,
      })
      Lf.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(m)
      layer.current = Lf.layerGroup().addTo(m)
      m.on('click', (e: L.LeafletMouseEvent) => {
        onPickRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng })
      })
      map.current = m
      setReady(true)
    })
    return () => {
      cancelled = true
      map.current?.remove()
      map.current = null
    }
  }, [])

  useEffect(() => {
    const Lf = lib.current
    if (!ready || !Lf || !layer.current) return
    layer.current.clearLayers()
    for (const mk of markers) {
      const c = Lf.circleMarker([mk.lat, mk.lng], {
        radius: mk.radius ?? 7,
        color: '#fff',
        weight: 1.5,
        fillColor: mk.color,
        fillOpacity: 0.85,
      })
      if (mk.popup) c.bindPopup(mk.popup)
      c.on('click', () => onMarkerRef.current?.(mk.id))
      c.addTo(layer.current)
    }
  }, [markers, ready])

  useEffect(() => {
    const Lf = lib.current
    if (!ready || !Lf || !map.current) return
    pin.current?.remove()
    pin.current = null
    if (picked) {
      const icon = Lf.divIcon({
        className: '',
        html: '<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;background:#dc2626;border:3px solid #fff;transform:rotate(-45deg);box-shadow:0 2px 6px rgba(0,0,0,.35)"></div>',
        iconSize: [22, 22],
        iconAnchor: [11, 22],
      })
      pin.current = Lf.marker([picked.lat, picked.lng], { icon }).addTo(map.current)
    }
  }, [picked, ready])

  const fLat = focus?.lat
  const fLng = focus?.lng
  const fZoom = focus?.zoom
  useEffect(() => {
    if (ready && fLat !== undefined && fLng !== undefined && map.current) {
      map.current.flyTo([fLat, fLng], fZoom ?? 12, { duration: 0.8 })
    }
  }, [fLat, fLng, fZoom, ready])

  return (
    <div className={cn('relative overflow-hidden rounded-lg border bg-muted', className)}>
      <div ref={el} className="absolute inset-0" role="application" aria-label="Map of Nigeria" />
      {!ready && (
        <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            <Loader2 className="size-4 animate-spin motion-reduce:animate-none" /> Loading map of Nigeria…
          </span>
        </div>
      )}
      {showSearch && ready && (
        <MapSearch
          onResult={(p, zoom) => {
            map.current?.flyTo([p.lat, p.lng], zoom, { duration: 0.8 })
            onPickRef.current?.(p)
          }}
        />
      )}
    </div>
  )
}

function MapSearch({
  onResult,
}: {
  onResult: (p: PickedPoint, zoom: number) => void
}) {
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<{ lat: string; lon: string; display_name: string; type: string }[]>([])
  const [err, setErr] = useState('')

  async function search(e: React.FormEvent) {
    e.preventDefault()
    if (!q.trim()) return
    setBusy(true)
    setErr('')
    try {
      const vb = `${NG_BOUNDS[0][1]},${NG_BOUNDS[1][0]},${NG_BOUNDS[1][1]},${NG_BOUNDS[0][0]}`
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=ng&viewbox=${vb}&q=${encodeURIComponent(q)}`,
        { headers: { Accept: 'application/json' } },
      )
      if (!r.ok) throw new Error()
      const data = await r.json()
      setResults(data)
      if (!data.length) setErr('No match. Try “ward, LGA, state”.')
    } catch {
      setErr('Search unavailable. Tap the map to drop a pin instead.')
    } finally {
      setBusy(false)
    }
  }

  function locate() {
    if (!navigator.geolocation) return setErr('Location not supported on this device.')
    setBusy(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(false)
        onResult({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: 'My current location' }, 16)
      },
      () => {
        setBusy(false)
        setErr('Could not get your location. Allow location access and retry.')
      },
      { enableHighAccuracy: true, timeout: 12000 },
    )
  }

  return (
    <div className="absolute inset-x-2 top-2 z-[500] sm:left-14 sm:right-auto sm:w-96">
      <form onSubmit={search} className="flex gap-1.5 rounded-lg bg-background/95 p-1.5 shadow-md">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Find a ward, LGA, town or polling unit…"
          aria-label="Search location in Nigeria"
          className="h-9 border-0 shadow-none focus-visible:ring-0"
        />
        <Button type="submit" size="icon" variant="secondary" aria-label="Search">
          {busy ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : <Search />}
        </Button>
        <Button type="button" size="icon" variant="outline" onClick={locate} aria-label="Use my current location">
          <Crosshair />
        </Button>
      </form>
      {(results.length > 0 || err) && (
        <div className="mt-1 max-h-60 overflow-auto rounded-lg bg-background/95 p-1 text-sm shadow-md">
          {err && <p className="px-2 py-1.5 text-muted-foreground">{err}</p>}
          {results.map((r) => (
            <button
              key={r.lat + r.lon}
              type="button"
              className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-secondary"
              onClick={() => {
                onResult({ lat: +r.lat, lng: +r.lon, label: r.display_name }, 14)
                setResults([])
              }}
            >
              <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
              <span className="line-clamp-2">{r.display_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

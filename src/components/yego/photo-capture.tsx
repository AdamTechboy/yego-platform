import { useEffect, useRef, useState } from 'react'
import { Camera, RefreshCw, Upload, X } from 'lucide-react'

import { Button } from '@/components/ui/button'

// Downscale to a small JPEG so profile photos stay light on low bandwidth.
function toThumb(source: CanvasImageSource, w: number, h: number) {
  const size = 360
  const scale = Math.min(1, size / Math.max(w, h))
  const c = document.createElement('canvas')
  c.width = Math.round(w * scale)
  c.height = Math.round(h * scale)
  c.getContext('2d')!.drawImage(source, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', 0.78)
}

export function PhotoCapture({
  value,
  onChange,
}: {
  value?: string
  onChange: (dataUrl: string | undefined) => void
}) {
  const video = useRef<HTMLVideoElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const [live, setLive] = useState(false)
  const [err, setErr] = useState('')

  const stop = () => {
    stream.current?.getTracks().forEach((t) => t.stop())
    stream.current = null
    setLive(false)
  }
  useEffect(() => stop, [])

  async function start() {
    setErr('')
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 } },
        audio: false,
      })
      stream.current = s
      setLive(true)
      requestAnimationFrame(() => {
        if (video.current) {
          video.current.srcObject = s
          void video.current.play()
        }
      })
    } catch {
      setErr('Camera unavailable. Allow camera access or upload a photo instead.')
    }
  }

  function snap() {
    const v = video.current
    if (!v) return
    onChange(toThumb(v, v.videoWidth, v.videoHeight))
    stop()
  }

  function upload(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/')) return setErr('Please choose an image file.')
    if (file.size > 8 * 1024 * 1024) return setErr('Image must be under 8 MB.')
    const imgEl = new Image()
    imgEl.onload = () => {
      onChange(toThumb(imgEl, imgEl.naturalWidth, imgEl.naturalHeight))
      URL.revokeObjectURL(imgEl.src)
    }
    imgEl.src = URL.createObjectURL(file)
  }

  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed bg-muted/50 p-5 sm:flex-row sm:items-start">
      <div className="relative grid size-40 shrink-0 place-items-center overflow-hidden rounded-lg bg-background ring-1 ring-border">
        {live ? (
          <video ref={video} playsInline muted className="h-full w-full -scale-x-100 object-cover" />
        ) : value ? (
          <>
            <img src={value} alt="Your passport photograph" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(undefined)}
              className="absolute right-1 top-1 rounded-full bg-background/90 p-1"
              aria-label="Remove photo"
            >
              <X className="size-4" />
            </button>
          </>
        ) : (
          <Camera className="size-10 text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 space-y-3 text-sm">
        <p className="text-muted-foreground">
          Face the camera on a plain background, with no hat or sunglasses. This photo appears on your YEGO ID card.
        </p>
        <div className="flex flex-wrap gap-2">
          {live ? (
            <>
              <Button type="button" onClick={snap}>
                <Camera /> Capture
              </Button>
              <Button type="button" variant="ghost" onClick={stop}>
                Cancel
              </Button>
            </>
          ) : (
            <Button type="button" variant="secondary" onClick={start}>
              {value ? <RefreshCw /> : <Camera />} {value ? 'Retake live photo' : 'Take live photo'}
            </Button>
          )}
          <Button type="button" variant="outline" asChild>
            <label className="cursor-pointer">
              <Upload /> Upload photo
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} />
            </label>
          </Button>
        </div>
        {err && <p className="text-destructive">{err}</p>}
      </div>
    </div>
  )
}

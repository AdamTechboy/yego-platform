import { useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { BellRing, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { markNotificationsRead, refreshNotifications, useDB } from '@/lib/demo-store'
import { timeAgo } from '@/lib/format'
import { cn } from '@/lib/utils'

export function CommandNotifications() {
  const { notifications } = useDB()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const announced = useRef(new Set<string>())

  const unread = notifications.filter((item) => !item.read)
  const actionable = unread.filter((item) => item.kind === 'incident' || item.kind === 'warning')
  const total = unread.length

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refreshNotifications().catch(() => {})
    }, 20_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const fresh = actionable.filter((item) => !announced.current.has(item.id))
    if (!fresh.length) return
    fresh.forEach((item) => announced.current.add(item.id))
    setOpen(true)
  }, [notifications, actionable])

  async function markSeen() {
    const ids = notifications.filter((item) => !item.read).map((item) => item.id)
    if (!ids.length) return
    try {
      await markNotificationsRead(ids)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update notifications.')
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" className="relative" onClick={() => setOpen(true)}>
        <BellRing />
        <span className="hidden sm:inline">Alerts</span>
        {total > 0 && (
          <span className="ml-1 grid min-w-5 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
            {total > 99 ? '99+' : total}
          </span>
        )}
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) void markSeen()
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="size-5 text-destructive" /> Command alerts
            </DialogTitle>
            <DialogDescription>
              New reports reach Command immediately. This list refreshes every 20 seconds.
            </DialogDescription>
          </DialogHeader>

          {notifications.length === 0 ? (
            <p className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">No alerts yet.</p>
          ) : (
            <ul className="space-y-2">
              {notifications.slice(0, 8).map((item) => (
                <li
                  key={item.id}
                  className={cn(
                    'rounded-lg border p-3',
                    !item.read && item.kind === 'incident' && 'border-destructive/40 bg-destructive/5',
                    !item.read && item.kind !== 'incident' && 'bg-secondary',
                  )}
                >
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="font-semibold uppercase tracking-wide">{item.kind.replace('_', ' ')}</span>
                    <time dateTime={item.createdAt}>{timeAgo(item.createdAt)}</time>
                  </div>
                  <p className="mt-1 text-sm font-bold">{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.body}</p>
                </li>
              ))}
            </ul>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Dismiss
            </Button>
            <Button
              onClick={() => {
                void markSeen()
                setOpen(false)
                void navigate({ to: '/command', search: { view: 'incidents' } })
              }}
            >
              Open incident queue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

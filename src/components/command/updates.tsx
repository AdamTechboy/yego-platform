import { useState } from 'react'
import { Megaphone, Send, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { NativeSelect } from '@/components/yego/fields'
import { can } from '@/lib/permissions'
import { postAnnouncement, useDB } from '@/lib/demo-store'
import { fmtDateTime, timeAgo } from '@/lib/format'
import { useActor } from './shared'

const KINDS = ['Announcement', 'Operational instruction', 'Alert', 'Training', 'Emergency'] as const

export function UpdatesView() {
  const { announcements } = useDB()
  const { role } = useActor()
  const [kind, setKind] = useState<(typeof KINDS)[number]>('Announcement')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [audience, setAudience] = useState('')
  const [busy, setBusy] = useState(false)

  const canPost = can(role, 'send:national') || can(role, 'send:state')

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (title.trim().length < 4 || body.trim().length < 4) {
      toast.error('Add a headline and a message.')
      return
    }
    setBusy(true)
    try {
      await postAnnouncement({ kind, title: title.trim(), body: body.trim(), audience: audience.trim() || undefined })
      setTitle('')
      setBody('')
      setAudience('')
      toast.success('Shared with the Command team.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not post the update.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="flex items-center gap-2 font-bold">
            <Megaphone className="size-4 text-primary" /> Shared Command updates
          </h2>
          <span className="text-xs text-muted-foreground">{announcements.length} messages</span>
        </div>
        <ul className="divide-y">
          {announcements.length === 0 && (
            <li className="p-6 text-center text-sm text-muted-foreground">No updates have been shared yet.</li>
          )}
          {announcements.map((item) => (
            <li key={item.id} className="p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-secondary px-2 py-0.5 font-bold text-secondary-foreground">
                  {item.kind}
                </span>
                <span className="text-muted-foreground">
                  {item.from} · {item.tier}
                </span>
                <time className="ml-auto text-muted-foreground" dateTime={item.at}>
                  {timeAgo(item.at)}
                </time>
              </div>
              <p className="mt-2 font-bold">{item.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Audience: {item.audience} · {fmtDateTime(item.at)}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <aside className="space-y-4">
        {canPost ? (
          <form onSubmit={submit} className="space-y-3 rounded-lg border bg-card p-4">
            <h2 className="flex items-center gap-2 font-bold">
              <Send className="size-4 text-primary" /> Share an update
            </h2>
            <p className="text-xs text-muted-foreground">
              Your message is scoped to your role. State and LGA coordinators reach their own area; national roles can
              address all Guards or a specific audience.
            </p>
            <label className="block text-xs font-semibold">
              Type
              <NativeSelect
                className="mt-1 h-9"
                options={[...KINDS]}
                value={kind}
                onChange={(event) => setKind(event.target.value as (typeof KINDS)[number])}
              />
            </label>
            <label className="block text-xs font-semibold">
              Headline
              <Input className="mt-1 h-9" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} />
            </label>
            <label className="block text-xs font-semibold">
              Message
              <Textarea className="mt-1" rows={4} value={body} onChange={(event) => setBody(event.target.value)} maxLength={4000} />
            </label>
            {(role === 'Super Administrator' || role === 'National YEGO Administrator') && (
              <label className="block text-xs font-semibold">
                Audience (optional)
                <Input
                  className="mt-1 h-9"
                  placeholder="All Guards"
                  value={audience}
                  onChange={(event) => setAudience(event.target.value)}
                />
              </label>
            )}
            <Button type="submit" className="w-full" disabled={busy}>
              <Send /> {busy ? 'Sharing…' : 'Share update'}
            </Button>
          </form>
        ) : (
          <div className="rounded-lg border border-dashed bg-card p-4 text-sm">
            <p className="flex items-center gap-2 font-semibold">
              <ShieldCheck className="size-4 text-primary" /> Read-only access
            </p>
            <p className="mt-1 text-muted-foreground">
              Your role receives shared updates but cannot post to this board.
            </p>
          </div>
        )}

        <div className="rounded-lg border bg-card p-4 text-sm">
          <p className="font-semibold">Who sees what</p>
          <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
            <li>National roles address the whole network or a named audience.</li>
            <li>Regional Coordinators address their zone.</li>
            <li>State Coordinators address their state; LGA Coordinators their LGA.</li>
            <li>Guards receive the messages for their state and LGA in the portal.</li>
          </ul>
        </div>
      </aside>
    </div>
  )
}

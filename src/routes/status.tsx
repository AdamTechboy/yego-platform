import { useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { MessageCircle, Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AppStatusBadge } from '@/components/yego/status'
import { PublicShell } from '@/components/yego/site-shell'
import { ApplicationTracker } from '@/components/yego/tracker'
import { WHATSAPP_CHANNEL_URL } from '@/lib/config'
import { confirmWhatsApp, useDB } from '@/lib/demo-store'
import { fmtDate } from '@/lib/format'

export const Route = createFileRoute('/status')({
  validateSearch: (s: Record<string, unknown>): { id?: string } => ({
    id: typeof s.id === 'string' ? s.id : undefined,
  }),
  head: () => ({ meta: [{ title: 'Check application status · YEGO' }] }),
  component: StatusPage,
})

function StatusPage() {
  const { id } = Route.useSearch()
  const navigate = useNavigate({ from: '/status' })
  const [q, setQ] = useState(id ?? '')
  const { applications } = useDB()
  const app = id ? applications.find((a) => a.id.toUpperCase() === id.trim().toUpperCase()) : undefined

  return (
    <PublicShell>
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 md:py-14">
        <h1 className="text-3xl font-black sm:text-4xl">Check application status</h1>
        <p className="mt-2 text-muted-foreground">Enter the Application ID you received after applying, e.g. YG-APP-240112.</p>
        <form
          className="mt-6 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void navigate({ search: { id: q.trim().toUpperCase() } })
          }}
        >
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="YG-APP-000000" aria-label="Application ID" className="h-11 font-mono uppercase" />
          <Button type="submit" size="lg" className="h-11">
            <Search /> Check
          </Button>
        </form>

        {id && !app && (
          <div className="mt-8 rounded-lg border border-destructive/30 bg-destructive/5 p-5 text-sm">
            No application found for <strong className="font-mono">{id}</strong>. Check the ID and try again.
          </div>
        )}

        {app && (
          <div className="mt-8 rounded-lg border bg-card">
            <div className="flex flex-wrap items-center gap-4 border-b p-5">
              {app.photo ? (
                <img src={app.photo} alt="" className="size-14 rounded-full object-cover" />
              ) : (
                <span className="grid size-14 place-items-center rounded-full bg-secondary font-display text-lg font-black text-secondary-foreground">
                  {app.fullName.split(' ').map((p) => p[0]).slice(0, 2).join('')}
                </span>
              )}
              <div className="flex-1">
                <p className="font-bold">{app.fullName}</p>
                <p className="text-sm text-muted-foreground">
                  {app.id} · {app.lga}, {app.stateOfResidence} · Applied {fmtDate(app.submittedAt)}
                </p>
              </div>
              <AppStatusBadge status={app.status} />
            </div>
            {!app.confirmedWhatsApp && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-accent/20 p-4 text-sm">
                <span>Your application is not yet confirmed on the WhatsApp Channel.</span>
                <Button asChild size="sm" className="bg-[#25D366] text-[#073b1c] hover:bg-[#25D366]/90" onClick={() => confirmWhatsApp(app.id)}>
                  <a href={WHATSAPP_CHANNEL_URL} target="_blank" rel="noopener noreferrer">
                    <MessageCircle /> Confirm now
                  </a>
                </Button>
              </div>
            )}
            <div className="p-5 sm:p-6">
              <ApplicationTracker app={app} />
            </div>
            <div className="border-t p-5 text-sm text-muted-foreground">
              Already approved? <Link to="/login" className="font-semibold text-primary hover:underline">Log in to the Guard portal</Link> with your Application ID and phone number.
            </div>
          </div>
        )}
      </div>
    </PublicShell>
  )
}

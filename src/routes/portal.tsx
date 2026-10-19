import { useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  ClipboardList,
  GraduationCap,
  Lock,
  LogOut,
  MapPin,
  Megaphone,
  Radio,
  Send,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { QuickReport } from '@/components/portal/quick-report'
import { TrainingCentre } from '@/components/portal/training-centre'
import { Field, NativeSelect } from '@/components/yego/fields'
import { YegoLogo } from '@/components/yego/logo'
import { NigeriaMap } from '@/components/yego/nigeria-map'
import {
  AppStatusBadge,
  IncidentStatusBadge,
  SEVERITY_COLOR,
  SeverityBadge,
} from '@/components/yego/status'
import { ApplicationTracker } from '@/components/yego/tracker'
import { raiseWarning, signOut, useDB } from '@/lib/demo-store'
import {
  EARLY_WARNING_TYPES,
  INCIDENT_STAGES,
  type Announcement,
  type Application,
} from '@/lib/fixtures'
import { fmtDateTime, nf, timeAgo } from '@/lib/format'
import { getState } from '@/lib/nigeria'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/portal')({
  head: () => ({ meta: [{ title: 'Guard portal · YEGO' }] }),
  component: PortalPage,
})

function PortalPage() {
  const { session, applications } = useDB()
  const navigate = useNavigate()
  const app = applications.find((a) => a.id === session?.applicationId)

  if (!session || !app) {
    return (
      <div className="grid min-h-screen place-items-center bg-muted/40 p-4">
        <div className="max-w-sm rounded-lg border bg-card p-6 text-center">
          <Lock className="mx-auto size-8 text-muted-foreground" />
          <h1 className="mt-3 text-xl font-black">Guard portal</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {session?.kind === 'command' ? 'You are signed in with a Command account.' : 'Log in with your Application ID to continue.'}
          </p>
          <Button asChild className="mt-4 w-full">
            <Link to={session?.kind === 'command' ? '/command' : '/login'}>{session?.kind === 'command' ? 'Go to Command' : 'Log in'}</Link>
          </Button>
        </div>
      </div>
    )
  }

  const active = app.status === 'Certified/Active'

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="sticky top-0 z-40 border-b bg-background">
        <div className="mx-auto flex h-14 max-w-content items-center justify-between gap-3 px-4 sm:px-6">
          <Link to="/" aria-label="YEGO home">
            <YegoLogo />
          </Link>
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground sm:inline">{active ? 'YEGO Guard' : 'Applicant'}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                signOut()
                void navigate({ to: '/login' })
              }}
            >
              <LogOut /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-content space-y-6 px-4 py-6 sm:px-6">
        <ProfileCard app={app} />
        {active ? <GuardWorkspace app={app} /> : <ApplicantWorkspace app={app} />}
      </main>
    </div>
  )
}

function ProfileCard({ app }: { app: Application }) {
  return (
    <section className="flex flex-wrap items-center gap-4 rounded-lg border bg-card p-4 sm:p-5">
      {app.photo ? (
        <img src={app.photo} alt="" className="size-16 rounded-lg object-cover" />
      ) : (
        <span className="grid size-16 place-items-center rounded-lg bg-primary font-display text-xl font-black text-primary-foreground">
          {app.fullName.split(' ').map((p) => p[0]).slice(0, 2).join('')}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-xl font-black">{app.fullName}</h1>
        <p className="text-sm text-muted-foreground">
          <span className="font-mono">{app.yegoId ?? app.id}</span> · {app.lga}, {app.stateOfResidence}
        </p>
        <p className="text-sm">
          <MapPin className="mr-1 inline size-3.5 text-primary" />
          {app.pollingUnit} · {app.ward}
        </p>
      </div>
      <AppStatusBadge status={app.status} />
    </section>
  )
}

function useMyAnnouncements(app: Application) {
  const { announcements } = useDB()
  return announcements.filter(
    (a) =>
      a.audience === 'All Guards' ||
      a.audience.includes(app.stateOfResidence) ||
      a.audience.includes(app.lga),
  )
}

function Messages({ items }: { items: Announcement[] }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">No messages yet.</p>
  return (
    <ul className="space-y-2">
      {items.map((m) => (
        <li key={m.id} className={cn('rounded-lg border bg-card p-4', m.kind === 'Emergency' && 'border-destructive/40 bg-destructive/5')}>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className={cn('rounded-full px-2 py-0.5 font-bold', m.kind === 'Emergency' ? 'bg-destructive text-white' : 'bg-secondary text-secondary-foreground')}>{m.kind}</span>
            <span className="text-muted-foreground">
              {m.from} · {timeAgo(m.at)}
            </span>
          </div>
          <p className="mt-1.5 font-bold">{m.title}</p>
          <p className="text-sm text-muted-foreground">{m.body}</p>
        </li>
      ))}
    </ul>
  )
}

function ApplicantWorkspace({ app }: { app: Application }) {
  const msgs = useMyAnnouncements(app).filter((m) => m.kind === 'Training' || m.kind === 'Announcement')
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <section className="rounded-lg border bg-card p-5 lg:row-span-2">
        <h2 className="flex items-center gap-2 font-black">
          <ClipboardList className="size-5 text-primary" /> Application progress
        </h2>
        <div className="mt-5">
          <ApplicationTracker app={app} />
        </div>
      </section>
      <section className="space-y-3 lg:col-span-2">
        <h2 className="flex items-center gap-2 font-black">
          <GraduationCap className="size-5 text-primary" /> Training Centre
        </h2>
        <TrainingCentre app={app} />
      </section>
      <section className="space-y-3 lg:col-span-2">
        <div className="flex items-start gap-3 rounded-lg border border-dashed bg-card p-4">
          <Lock className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          <div className="text-sm">
            <p className="font-semibold">Incident reporting & polling-unit tools are locked</p>
            <p className="text-muted-foreground">They unlock automatically once you are certified and deployed as a YEGO Guard.</p>
          </div>
        </div>
        <h2 className="flex items-center gap-2 pt-2 font-black">
          <Megaphone className="size-5 text-primary" /> Updates for you
        </h2>
        <Messages items={msgs} />
      </section>
    </div>
  )
}

function GuardWorkspace({ app }: { app: Application }) {
  const { incidents, warnings } = useDB()
  const msgs = useMyAnnouncements(app)
  const mine = incidents.filter((i) => i.reporter === app.fullName)
  const st = getState(app.stateOfResidence)
  const puIncidents = incidents.filter((i) => i.pollingUnit === app.pollingUnit)
  const areaWarnings = warnings.filter((w) => w.state === app.stateOfResidence && w.access === 'All Guards in area')
  const [checkedIn, setCheckedIn] = useState(false)

  return (
    <Tabs defaultValue="report">
      <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
        <TabsTrigger value="report" className="flex-none">
          <Radio /> Election-Day report
        </TabsTrigger>
        <TabsTrigger value="pu" className="flex-none">
          <MapPin /> My polling unit
        </TabsTrigger>
        <TabsTrigger value="warn" className="flex-none">
          <BellRing /> Early warning
        </TabsTrigger>
        <TabsTrigger value="msgs" className="flex-none">
          <Megaphone /> Messages ({msgs.length})
        </TabsTrigger>
        <TabsTrigger value="mine" className="flex-none">
          <ClipboardList /> My reports ({mine.length})
        </TabsTrigger>
        <TabsTrigger value="training" className="flex-none">
          <GraduationCap /> Training
        </TabsTrigger>
      </TabsList>

      <TabsContent value="report" className="mt-4 space-y-3">
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm">
          <AlertTriangle className="size-4 shrink-0 text-destructive" />
          <span>
            <strong>Danger to life?</strong> Move to safety and call <strong>112</strong> first, then report.
          </span>
        </div>
        <QuickReport guard={app} />
      </TabsContent>

      <TabsContent value="pu" className="mt-4">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4">
            <div className="rounded-lg border bg-card p-5">
              <p className="text-xs font-bold uppercase text-primary">Assigned polling unit</p>
              <p className="mt-1 text-lg font-black">{app.pollingUnit}</p>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <dt className="text-muted-foreground">Ward</dt>
                <dd>{app.ward}</dd>
                <dt className="text-muted-foreground">LGA</dt>
                <dd>{app.lga}</dd>
                <dt className="text-muted-foreground">State</dt>
                <dd>{app.stateOfResidence}</dd>
                <dt className="text-muted-foreground">Zone</dt>
                <dd>{st?.zone}</dd>
                <dt className="text-muted-foreground">State PUs</dt>
                <dd>{st && nf.format(st.pollingUnits)}</dd>
                <dt className="text-muted-foreground">Reports here</dt>
                <dd>{puIncidents.length}</dd>
              </dl>
              <Button
                className="mt-4 w-full"
                variant={checkedIn ? 'secondary' : 'default'}
                onClick={() => {
                  setCheckedIn(true)
                  toast.success('Checked in. Your coordinator can see you are on duty.')
                }}
              >
                <CheckCircle2 /> {checkedIn ? 'Checked in' : 'Check in on arrival'}
              </Button>
            </div>
            {areaWarnings.length > 0 && (
              <div className="rounded-lg border border-accent bg-accent/15 p-4 text-sm">
                <p className="font-bold">Area advisories</p>
                {areaWarnings.map((w) => (
                  <p key={w.id} className="mt-1">
                    <strong>{w.level}:</strong> {w.title}
                  </p>
                ))}
              </div>
            )}
          </div>
          <NigeriaMap
            className="h-96 lg:col-span-2"
            showSearch={false}
            focus={puIncidents[0] ? { lat: puIncidents[0].lat, lng: puIncidents[0].lng, zoom: 15 } : st ? { lat: st.lat, lng: st.lng, zoom: 11 } : null}
            markers={puIncidents.map((i) => ({ id: i.id, lat: i.lat, lng: i.lng, color: SEVERITY_COLOR[i.severity], popup: `<b>${i.type}</b><br/>${i.id} · ${i.status}` }))}
          />
        </div>
      </TabsContent>

      <TabsContent value="warn" className="mt-4">
        <WarningTip app={app} />
      </TabsContent>

      <TabsContent value="msgs" className="mt-4">
        <Messages items={msgs} />
      </TabsContent>

      <TabsContent value="mine" className="mt-4">
        {mine.length === 0 ? (
          <p className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">You have not submitted any reports yet.</p>
        ) : (
          <ul className="space-y-2">
            {mine.map((i) => {
              const idx = INCIDENT_STAGES.indexOf(i.status)
              return (
                <li key={i.id} className="rounded-lg border bg-card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-bold">{i.type}</p>
                    <div className="flex gap-1.5">
                      <SeverityBadge severity={i.severity} />
                      <IncidentStatusBadge status={i.status} />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-mono">{i.id}</span> · {fmtDateTime(i.occurredAt)}
                  </p>
                  <div className="mt-3 flex gap-1" aria-label={`Progress: ${i.status}`}>
                    {INCIDENT_STAGES.filter((s) => s !== 'Unverified').map((s) => (
                      <span key={s} className={cn('h-1.5 flex-1 rounded-full', INCIDENT_STAGES.indexOf(s) <= idx ? 'bg-primary' : 'bg-muted')} />
                    ))}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </TabsContent>

      <TabsContent value="training" className="mt-4">
        <TrainingCentre app={app} />
      </TabsContent>
    </Tabs>
  )
}

function WarningTip({ app }: { app: Application }) {
  const st = getState(app.stateOfResidence)
  const [type, setType] = useState('')
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [files, setFiles] = useState(0)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!type || title.trim().length < 4 || summary.trim().length < 10) return toast.error('Add a type, a title and a short description.')
    raiseWarning({
      type,
      title: title.trim(),
      summary: summary.trim(),
      state: app.stateOfResidence,
      lga: app.lga,
      level: 'Watch',
      access: 'Command only',
      raisedBy: `Guard ${app.yegoId}`,
      evidence: files,
      lat: (st?.lat ?? 9) + (Math.random() - 0.5) * 0.1,
      lng: (st?.lng ?? 8) + (Math.random() - 0.5) * 0.1,
    })
    setType('')
    setTitle('')
    setSummary('')
    setFiles(0)
    toast.success('Early-warning tip sent confidentially to Command.')
  }

  return (
    <form onSubmit={submit} className="max-w-2xl space-y-4 rounded-lg border bg-card p-5">
      <div>
        <h2 className="font-black">Share an early-warning tip</h2>
        <p className="text-sm text-muted-foreground">
          Seen signs of tension, threats or misinformation before they turn into incidents? Tips go only to Command and are never
          published.
        </p>
      </div>
      <Field label="Type of risk" htmlFor="ewt">
        <NativeSelect id="ewt" placeholder="Select" options={EARLY_WARNING_TYPES} value={type} onChange={(e) => setType(e.target.value)} />
      </Field>
      <Field label="Headline" htmlFor="ewh">
        <Input id="ewh" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Youths being mobilised near the collation centre" />
      </Field>
      <Field label="What have you seen or heard?" htmlFor="ews">
        <Textarea id="ews" rows={4} value={summary} onChange={(e) => setSummary(e.target.value)} />
      </Field>
      <Field label="Photo / video evidence (optional)" htmlFor="ewf">
        <Input id="ewf" type="file" accept="image/*,video/*" multiple onChange={(e) => setFiles(e.target.files?.length ?? 0)} />
      </Field>
      <Button type="submit">
        <Send /> Send to Command
      </Button>
    </form>
  )
}

import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { KeyRound, Lock, ShieldCheck, UserRound } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Field } from '@/components/yego/fields'
import { YegoLogo } from '@/components/yego/logo'
import { findAccount, signIn, signInApplicant } from '@/lib/demo-store'
import { DEMO_ACCOUNTS, SEED_APPLICATIONS } from '@/lib/fixtures'

export const Route = createFileRoute('/login')({
  head: () => ({ meta: [{ title: 'Login · YEGO Platform' }] }),
  component: LoginPage,
})

// Preview-only password. Real credentials arrive with Netlify Identity.
const PREVIEW_PASSWORD = 'yego-preview'

function LoginPage() {
  const navigate = useNavigate()
  const [appId, setAppId] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')

  function guardLogin(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    const s = signInApplicant(appId, phone)
    if (!s) return setErr('Application ID and phone number do not match our records.')
    toast.success(`Welcome, ${s.name.split(' ')[0]}`)
    void navigate({ to: '/portal' })
  }

  function staffLogin(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    const a = findAccount(email)
    if (!a || password !== PREVIEW_PASSWORD) return setErr('Invalid email or password.')
    signIn(a)
    toast.success(`Signed in as ${a.role}`)
    void navigate({ to: a.kind === 'command' ? '/command' : '/portal' })
  }

  const guardDemo = SEED_APPLICATIONS[2]
  const applicantDemo = SEED_APPLICATIONS[4]

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-ink p-10 text-white lg:flex">
        <img
          src="/.netlify/images?url=/img/hero-observers.png&w=1000&fm=webp&q=60"
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-25"
        />
        <a href="/" className="relative">
          <YegoLogo inverted />
        </a>
        <div className="relative">
          <h2 className="text-4xl font-black leading-tight">Secure access for Guards and Command.</h2>
          <p className="mt-3 max-w-md text-white/70">
            Role-based access means every user only sees the information their responsibility requires, from National Command to
            a single polling unit.
          </p>
        </div>
        <p className="relative flex items-center gap-2 text-xs text-white/60">
          <Lock className="size-3.5" /> All sessions are logged for audit.
        </p>
      </div>

      <div className="flex flex-col justify-center px-4 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-md">
          <a href="/" className="lg:hidden">
            <YegoLogo />
          </a>
          <h1 className="mt-8 text-3xl font-black lg:mt-0">Log in</h1>
          <p className="mt-1 text-muted-foreground">Choose how you’re signing in.</p>

          <Tabs defaultValue="guard" className="mt-6" onValueChange={() => setErr('')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="guard">
                <UserRound /> Guard / Applicant
              </TabsTrigger>
              <TabsTrigger value="staff">
                <ShieldCheck /> Command staff
              </TabsTrigger>
            </TabsList>

            <TabsContent value="guard">
              <form onSubmit={guardLogin} className="mt-4 space-y-4">
                <Field label="Application ID" htmlFor="appid">
                  <Input id="appid" className="font-mono uppercase" placeholder="YG-APP-000000" value={appId} onChange={(e) => setAppId(e.target.value)} />
                </Field>
                <Field label="Phone number used to apply" htmlFor="ph">
                  <Input id="ph" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </Field>
                {err && <p className="text-sm font-medium text-destructive">{err}</p>}
                <Button type="submit" size="lg" className="w-full">
                  <KeyRound /> Log in to Guard portal
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="staff">
              <form onSubmit={staffLogin} className="mt-4 space-y-4">
                <Field label="Official email" htmlFor="em">
                  <Input id="em" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
                </Field>
                <Field label="Password" htmlFor="pw">
                  <Input id="pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                </Field>
                {err && <p className="text-sm font-medium text-destructive">{err}</p>}
                <Button type="submit" size="lg" className="w-full">
                  <ShieldCheck /> Log in to Command
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <details className="mt-8 rounded-lg border bg-muted/50 p-4 text-sm">
            <summary className="cursor-pointer font-semibold">Preview accounts</summary>
            <p className="mt-2 text-muted-foreground">
              Staff password for all preview accounts: <code className="rounded bg-background px-1">{PREVIEW_PASSWORD}</code>
            </p>
            <ul className="mt-3 space-y-1.5">
              {DEMO_ACCOUNTS.filter((a) => a.kind === 'command').map((a) => (
                <li key={a.email}>
                  <button type="button" className="text-left hover:underline" onClick={() => { setEmail(a.email); setPassword(PREVIEW_PASSWORD) }}>
                    <code>{a.email}</code> <span className="text-muted-foreground">({a.role})</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-muted-foreground">Guard tab:</p>
            <ul className="mt-1 space-y-1.5">
              {[
                { app: guardDemo, label: 'certified Guard' },
                { app: applicantDemo, label: 'applicant in training' },
              ].map(({ app, label }) => (
                <li key={app.id}>
                  <button type="button" className="text-left hover:underline" onClick={() => { setAppId(app.id); setPhone(app.phone) }}>
                    <code>{app.id}</code> / <code>{app.phone}</code> <span className="text-muted-foreground">({label})</span>
                  </button>
                </li>
              ))}
            </ul>
          </details>
        </div>
      </div>
    </div>
  )
}

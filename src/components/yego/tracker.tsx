import { Check, Circle, XCircle } from 'lucide-react'

import { APPLICATION_STAGES, type Application } from '@/lib/fixtures'
import { fmtDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'

const NEXT_STEP: Record<string, string> = {
  'Application Submitted': 'Confirm on the WhatsApp Channel. Your state desk reviews new applications within 72 hours.',
  'Under Review': 'Your details and NIN are being checked by the screening desk.',
  Screening: 'You may receive a short phone or in-person screening call from your State Coordinator.',
  Approved: 'Approved. Your training access is being prepared.',
  'Training Required': 'Log in to the Guard portal and complete all Training Centre modules and quizzes.',
  'Training Completed': 'Training complete. Certification and polling-unit assignment follow.',
  'Certified/Active': 'You are an active YEGO Guard. Check the portal for your polling unit and instructions.',
  'Not Approved': 'Your application was not approved this cycle. You may contact your State Coordinator for feedback.',
}

export function ApplicationTracker({ app }: { app: Application }) {
  const rejected = app.status === 'Not Approved'
  const idx = rejected
    ? app.history.filter((h) => (APPLICATION_STAGES as readonly string[]).includes(h.action)).length - 1
    : APPLICATION_STAGES.indexOf(app.status as (typeof APPLICATION_STAGES)[number])
  const at = (s: string) => [...app.history].reverse().find((h) => h.action === s)?.at

  return (
    <div>
      <ol className="relative space-y-0">
        {APPLICATION_STAGES.map((s, i) => {
          const done = i < idx || (i === idx && s === 'Certified/Active')
          const current = i === idx && !done
          const stamp = at(s)
          return (
            <li key={s} className="relative flex gap-4 pb-6 last:pb-0">
              {i < APPLICATION_STAGES.length - 1 && (
                <span className={cn('absolute left-[15px] top-8 h-[calc(100%-2rem)] w-0.5', i < idx ? 'bg-primary' : 'bg-border')} />
              )}
              <span
                className={cn(
                  'relative z-10 grid size-8 shrink-0 place-items-center rounded-full border-2',
                  done && 'border-primary bg-primary text-primary-foreground',
                  current && !rejected && 'border-primary bg-background text-primary ring-4 ring-primary/15',
                  current && rejected && 'border-destructive bg-destructive text-white',
                  !done && !current && 'border-border bg-background text-muted-foreground',
                )}
              >
                {done ? <Check className="size-4" /> : current && rejected ? <XCircle className="size-4" /> : <Circle className="size-2.5 fill-current" />}
              </span>
              <div className="pt-1">
                <p className={cn('font-semibold', !done && !current && 'text-muted-foreground')}>
                  {current && rejected ? 'Not Approved' : s}
                </p>
                {stamp && <p className="text-xs text-muted-foreground">{fmtDateTime(stamp)}</p>}
                {current && <p className="mt-1 max-w-md text-sm text-muted-foreground">{NEXT_STEP[rejected ? 'Not Approved' : s]}</p>}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

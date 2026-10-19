import { cn } from '@/lib/utils'

export function YegoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={cn('size-9 shrink-0', className)}
    >
      <path
        d="M32 3 7 11v19c0 15.5 10.6 26.7 25 31 14.4-4.3 25-15.5 25-31V11L32 3Z"
        fill="#0b6b3a"
      />
      <path d="M32 8.3 12 14.7V30c0 12.6 8.4 21.8 20 25.6V8.3Z" fill="#0f8a4b" />
      <path
        d="M14 31s7-10 18-10 18 10 18 10-7 10-18 10-18-10-18-10Z"
        fill="#fff"
      />
      <circle cx="32" cy="31" r="6.5" fill="#0b6b3a" />
      <path
        d="m28.6 31 2.4 2.4 4.6-4.8"
        stroke="#f5c542"
        strokeWidth="2.4"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function YegoLogo({
  className,
  inverted = false,
}: {
  className?: string
  inverted?: boolean
}) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <YegoMark />
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            'font-display text-xl font-black tracking-tight',
            inverted ? 'text-white' : 'text-foreground',
          )}
        >
          YEGO
        </span>
        <span
          className={cn(
            'text-[10px] font-semibold uppercase tracking-[0.14em]',
            inverted ? 'text-white/70' : 'text-muted-foreground',
          )}
        >
          Electoral Guards
        </span>
      </span>
    </span>
  )
}

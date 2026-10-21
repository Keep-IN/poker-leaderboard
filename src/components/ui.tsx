import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { initials } from '../lib/format'
import type { MatchStatus } from '../lib/supabase'

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

type Variant = 'gold' | 'ghost' | 'danger' | 'outline'

const variants: Record<Variant, string> = {
  gold: 'bg-gold-400 text-felt-950 hover:bg-gold-300 shadow-lg shadow-gold-500/20',
  ghost: 'bg-white/5 text-slate-100 hover:bg-white/10',
  danger: 'bg-chip-red/15 text-red-300 hover:bg-chip-red/25',
  outline: 'border border-gold-400/50 text-gold-300 hover:bg-gold-400/10',
}

export function Button({
  variant = 'gold',
  loading,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  return (
    <button
      className={cx(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Spinner small />}
      {children}
    </button>
  )
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cx('rounded-2xl border border-white/8 bg-felt-800/80 p-4 backdrop-blur', className)}>{children}</div>
  )
}

export function Spinner({ small }: { small?: boolean }) {
  return (
    <span
      className={cx(
        'inline-block animate-spin rounded-full border-2 border-current border-t-transparent',
        small ? 'size-4' : 'size-7 text-gold-400',
      )}
    />
  )
}

export function PageLoader() {
  return (
    <div className="flex justify-center py-16">
      <Spinner />
    </div>
  )
}

const avatarColors = ['bg-emerald-600', 'bg-sky-600', 'bg-violet-600', 'bg-rose-600', 'bg-amber-600', 'bg-teal-600', 'bg-fuchsia-600', 'bg-indigo-600']

export function Avatar({ name, id, size = 'md' }: { name: string; id: string; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const hash = [...id].reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const sizes = { sm: 'size-8 text-xs', md: 'size-10 text-sm', lg: 'size-14 text-lg', xl: 'size-20 text-2xl' }
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white ring-2 ring-black/20',
        avatarColors[hash % avatarColors.length],
        sizes[size],
      )}
    >
      {initials(name)}
    </span>
  )
}

const statusStyles: Record<MatchStatus, [string, string]> = {
  open: ['Menunggu player', 'bg-sky-500/15 text-sky-300'],
  ongoing: ['Berlangsung', 'bg-emerald-500/15 text-emerald-300'],
  finished: ['Selesai', 'bg-white/10 text-slate-300'],
  cancelled: ['Dibatalkan', 'bg-chip-red/15 text-red-300'],
}

export function StatusBadge({ status }: { status: MatchStatus }) {
  const [label, style] = statusStyles[status]
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium', style)}>
      {status === 'ongoing' && <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />}
      {label}
    </span>
  )
}

export function EmptyState({ icon, title, text }: { icon: string; title: string; text?: string }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <div className="mb-3 text-4xl">{icon}</div>
      <p className="font-semibold">{title}</p>
      {text && <p className="mt-1 text-sm text-slate-400">{text}</p>}
    </div>
  )
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null
  return <p className="rounded-xl bg-chip-red/15 px-3 py-2 text-sm text-red-300">{children}</p>
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-2 px-1 text-sm font-semibold uppercase tracking-wider text-slate-400">{children}</h2>
}

export function Chevron() {
  return (
    <svg className="size-4 shrink-0 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

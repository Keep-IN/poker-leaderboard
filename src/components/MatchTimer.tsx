import { useEffect, useRef, useState } from 'react'
import { formatDateTime } from '../lib/format'
import { formatCountdown, useNow } from '../lib/missions'
import { supabase } from '../lib/supabase'
import { cx } from './ui'

/** Pilihan timer: tanpa timer, N menit dari sekarang (dihitung saat disimpan), atau jam tertentu. */
export type TimerChoice = { kind: 'off' } | { kind: 'in'; min: number } | { kind: 'at'; local: string }

const QUICK = [5, 10, 15, 30, 60]
const pad = (n: number) => String(n).padStart(2, '0')
/** datetime-local value (waktu lokal browser). */
export const toLocalInput = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`

/** Waktu mulai dari pilihan timer (null = tanpa timer, undefined = jam yang dipilih tidak valid). */
export function timerDate(c: TimerChoice): Date | null | undefined {
  if (c.kind === 'off') return null
  if (c.kind === 'in') return new Date(Date.now() + c.min * 60_000)
  const d = new Date(c.local)
  return Number.isNaN(d.getTime()) || d.getTime() < Date.now() + 60_000 ? undefined : d
}

export function TimerPicker({ value, onChange, allowOff = true }: { value: TimerChoice; onChange: (c: TimerChoice) => void; allowOff?: boolean }) {
  const chip = (active: boolean) =>
    cx('min-h-10 rounded-lg px-3 text-sm font-semibold transition', active ? 'bg-brand-400 text-on-accent' : 'bg-ink/5 text-slate-300 hover:bg-ink/10')
  const bad = value.kind === 'at' && timerDate(value) === undefined
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {allowOff && (
          <button type="button" className={chip(value.kind === 'off')} onClick={() => onChange({ kind: 'off' })}>
            Tanpa timer
          </button>
        )}
        {QUICK.map((m) => (
          <button key={m} type="button" className={chip(value.kind === 'in' && value.min === m)} onClick={() => onChange({ kind: 'in', min: m })}>
            {m < 60 ? `${m} menit` : '1 jam'}
          </button>
        ))}
        <button
          type="button"
          className={chip(value.kind === 'at')}
          onClick={() => onChange({ kind: 'at', local: toLocalInput(new Date(Date.now() + 2 * 3600_000)) })}
        >
          Pilih jam
        </button>
      </div>
      {value.kind === 'at' && (
        <input
          type="datetime-local"
          value={value.local}
          onChange={(e) => onChange({ kind: 'at', local: e.target.value })}
          className={cx(
            'h-12 w-full rounded-xl border bg-surface-950/60 px-4 text-base outline-none [color-scheme:dark] focus:ring-2 focus:ring-brand-400/20',
            bad ? 'border-chip-red/70' : 'border-ink/10 focus:border-brand-400/70',
          )}
        />
      )}
      {bad && <p className="text-xs text-red-300">Pilih waktu minimal 1 menit dari sekarang.</p>}
    </div>
  )
}

/**
 * Hitung mundur mulai otomatis di halaman match. Saat waktunya tiba, halaman siapa pun yang sedang membuka match ini
 * meminta server memulai match yang sudah jatuh tempo (server yang memutuskan; pemain kurang = tetap menunggu).
 */
export function TimerBanner({ startAt, players, minPlayers, onStarted }: { startAt: string; players: number; minPlayers: number; onStarted: () => void }) {
  const now = useNow()
  const left = new Date(startAt).getTime() - now
  const tried = useRef('')
  const due = left <= 0
  const enough = players >= minPlayers

  useEffect(() => {
    const key = `${startAt}|${players}`
    if (!due || !enough || tried.current === key) return
    tried.current = key
    supabase.rpc('start_due_matches').then(() => onStarted())
  }, [due, enough, startAt, players, onStarted])

  return (
    <div className={cx('timer-box rounded-2xl border px-4 py-3', due && !enough ? 'border-amber-400/50 bg-amber-500/10' : 'border-brand-400/40 bg-brand-400/10')}>
      <p className="text-xs uppercase tracking-wider text-slate-400">⏱ Mulai otomatis</p>
      {!due ? (
        <p className="mt-0.5 font-mono text-2xl font-extrabold text-brand-300">{formatCountdown(left)}</p>
      ) : enough ? (
        <p className="mt-0.5 font-bold text-brand-300">Memulai match…</p>
      ) : (
        <p className="mt-0.5 font-bold text-amber-300">Waktunya tiba, tapi pemain belum cukup</p>
      )}
      <p className="text-xs text-slate-400">
        {formatDateTime(startAt)}
        {!enough && ` · butuh min. ${minPlayers} player (${players} sekarang), langsung mulai begitu cukup`}
      </p>
    </div>
  )
}

/** Panel host di halaman match: atur, ubah, atau hapus timer. */
export function TimerEditor({ matchId, startAt, onSaved }: { matchId: string; startAt: string | null; onSaved: () => void }) {
  const [open, setOpen] = useState(false)
  const [choice, setChoice] = useState<TimerChoice>({ kind: 'in', min: 15 })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save(c: TimerChoice) {
    const d = timerDate(c)
    if (d === undefined) return
    setBusy(true)
    setError('')
    const { error } = await supabase.rpc('set_match_timer', { p_match: matchId, p_start_at: d ? d.toISOString() : null })
    setBusy(false)
    if (error) return setError(error.message)
    setOpen(false)
    onSaved()
  }

  if (!open)
    return (
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(true)} className="min-h-10 flex-1 rounded-xl border border-brand-400/40 text-sm font-semibold text-brand-300 hover:bg-brand-400/10">
          ⏱ {startAt ? 'Ubah timer' : 'Atur timer mulai otomatis'}
        </button>
        {startAt && (
          <button type="button" disabled={busy} onClick={() => save({ kind: 'off' })} className="min-h-10 rounded-xl bg-ink/5 px-4 text-sm font-semibold text-slate-300 hover:bg-ink/10">
            Hapus timer
          </button>
        )}
      </div>
    )

  return (
    <div className="space-y-3 rounded-2xl border border-brand-400/40 bg-surface-800/80 p-4">
      <p className="text-sm font-semibold">⏱ Mulai otomatis dalam…</p>
      <TimerPicker value={choice} onChange={setChoice} allowOff={false} />
      {error && <p className="text-sm text-red-300">{error}</p>}
      <div className="flex gap-2">
        <button type="button" disabled={busy || timerDate(choice) === undefined} onClick={() => save(choice)}
          className="min-h-10 flex-1 rounded-xl bg-brand-400 text-sm font-bold text-on-accent disabled:opacity-50">
          {busy ? '…' : 'Simpan timer'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="min-h-10 rounded-xl bg-ink/5 px-4 text-sm font-semibold text-slate-300">
          Batal
        </button>
      </div>
    </div>
  )
}

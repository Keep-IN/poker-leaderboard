import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar, Card, EmptyState, PageLoader, cx } from '../components/ui'
import { useAuth } from '../lib/auth'
import { formatMonth } from '../lib/format'
import { supabase, type LeaderboardRow } from '../lib/supabase'

type Tab = 'monthly' | 'all'

export default function Leaderboard() {
  const { profile } = useAuth()
  const [tab, setTab] = useState<Tab>('monthly')
  const [monthOffset, setMonthOffset] = useState(0)
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null)

  const month = useMemo(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth() + monthOffset, 1)
  }, [monthOffset])

  useEffect(() => {
    let cancelled = false
    setRows(null)
    const params =
      tab === 'monthly'
        ? {
            p_from: month.toISOString(),
            p_to: new Date(month.getFullYear(), month.getMonth() + 1, 1).toISOString(),
          }
        : {}
    supabase.rpc('get_leaderboard', params).then(({ data }) => {
      if (!cancelled) setRows(((data as LeaderboardRow[]) ?? []).map((r) => ({ ...r, wins: Number(r.wins), played: Number(r.played) })))
    })
    return () => {
      cancelled = true
    }
  }, [tab, month])

  const ranked = useMemo(() => rank(rows ?? []), [rows])
  const podium = ranked.slice(0, 3)
  const rest = ranked.slice(3)

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Leaderboard</h1>

      <div className="grid grid-cols-2 gap-1 rounded-xl bg-felt-950/60 p-1">
        {(['monthly', 'all'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cx(
              'min-h-10 rounded-lg text-sm font-semibold transition',
              tab === t ? 'bg-gold-400 text-felt-950' : 'text-slate-400 hover:text-slate-200',
            )}
          >
            {t === 'monthly' ? 'Bulanan' : 'All Time'}
          </button>
        ))}
      </div>

      {tab === 'monthly' && (
        <div className="flex items-center justify-between">
          <MonthButton dir="prev" onClick={() => setMonthOffset((o) => o - 1)} />
          <span className="font-semibold capitalize">{formatMonth(month)}</span>
          <MonthButton dir="next" onClick={() => setMonthOffset((o) => o + 1)} disabled={monthOffset >= 0} />
        </div>
      )}

      {!rows ? (
        <PageLoader />
      ) : ranked.length === 0 ? (
        <Card>
          <EmptyState icon="🏆" title="Belum ada pemenang" text={tab === 'monthly' ? 'Belum ada match selesai di bulan ini.' : 'Belum ada match selesai.'} />
        </Card>
      ) : (
        <>
          <Podium entries={podium} meId={profile?.id} />
          {rest.length > 0 && (
            <Card className="divide-y divide-white/5 p-0">
              {rest.map((r) => (
                <Link
                  key={r.player_id}
                  to={`/players/${r.player_id}`}
                  className={cx('flex items-center gap-3 px-4 py-3 transition hover:bg-white/5', r.player_id === profile?.id && 'bg-gold-400/8')}
                >
                  <span className="w-6 text-center text-sm font-bold text-slate-400">{r.rank}</span>
                  <Avatar name={r.name} id={r.player_id} size="sm" />
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {r.name}
                    {r.player_id === profile?.id && <span className="ml-1.5 text-xs text-gold-300">(kamu)</span>}
                  </span>
                  <span className="text-right">
                    <span className="font-bold text-gold-400">{r.wins}</span>
                    <span className="ml-1 text-xs text-slate-400">win</span>
                  </span>
                </Link>
              ))}
            </Card>
          )}
        </>
      )}
    </div>
  )
}

type Ranked = LeaderboardRow & { rank: number }

/** Standard competition ranking (1, 1, 3...) on wins. */
function rank(rows: LeaderboardRow[]): Ranked[] {
  return rows.map((r, i) => ({
    ...r,
    rank: i > 0 && rows[i - 1].wins === r.wins ? rows.findIndex((x) => x.wins === r.wins) + 1 : i + 1,
  }))
}

const podiumStyles = [
  { height: 'h-28', medal: '🥇', ring: 'ring-gold-400', bar: 'from-gold-400/40 to-gold-500/10 border-gold-400/50' },
  { height: 'h-20', medal: '🥈', ring: 'ring-slate-300', bar: 'from-slate-300/30 to-slate-400/5 border-slate-300/40' },
  { height: 'h-14', medal: '🥉', ring: 'ring-amber-700', bar: 'from-amber-700/40 to-amber-800/10 border-amber-700/50' },
]

function Podium({ entries, meId }: { entries: Ranked[]; meId?: string }) {
  // Visual order: 2nd, 1st, 3rd
  const order = [1, 0, 2]
  return (
    <div className="grid grid-cols-3 items-end gap-2 pt-6">
      {order.map((idx) => {
        const e = entries[idx]
        const style = podiumStyles[idx]
        if (!e) return <div key={idx} />
        return (
          <Link key={e.player_id} to={`/players/${e.player_id}`} className="flex min-w-0 flex-col items-center">
            {idx === 0 && <span className="mb-1 text-2xl">👑</span>}
            <div className={cx('rounded-full ring-4', style.ring)}>
              <Avatar name={e.name} id={e.player_id} size={idx === 0 ? 'xl' : 'lg'} />
            </div>
            <p className={cx('mt-2 w-full truncate text-center text-sm font-semibold', e.player_id === meId && 'text-gold-300')}>
              {e.name}
            </p>
            <p className="text-xs text-slate-400">
              <span className="text-base font-extrabold text-gold-400">{e.wins}</span> win
            </p>
            <div
              className={cx(
                'mt-2 flex w-full items-start justify-center rounded-t-xl border border-b-0 bg-gradient-to-b pt-2 text-2xl',
                style.height,
                style.bar,
              )}
            >
              {style.medal}
            </div>
          </Link>
        )
      })}
    </div>
  )
}

function MonthButton({ dir, onClick, disabled }: { dir: 'prev' | 'next'; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === 'prev' ? 'Bulan sebelumnya' : 'Bulan berikutnya'}
      className="flex size-10 items-center justify-center rounded-xl bg-white/5 text-slate-300 transition hover:bg-white/10 disabled:opacity-30"
    >
      <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d={dir === 'prev' ? 'm15 6-6 6 6 6' : 'm9 6 6 6-6 6'} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}

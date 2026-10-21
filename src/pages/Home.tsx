import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar, Card, Chevron, EmptyState, PageLoader, SectionTitle, StatusBadge, cx } from '../components/ui'
import { useAuth } from '../lib/auth'
import { formatDate, winRate } from '../lib/format'
import { supabase, type MatchStatus, type PlayerStatus, type Profile } from '../lib/supabase'

export default function Home() {
  const { profile } = useAuth()
  if (!profile) return <PageLoader />
  return profile.role === 'dealer' ? <DealerHome profile={profile} /> : <PlayerHome profile={profile} />
}

interface PlayerMatchRow {
  status: PlayerStatus
  match: {
    id: string
    title: string
    status: MatchStatus
    created_at: string
    finished_at: string | null
    winner: { name: string } | null
  }
}

function PlayerHome({ profile }: { profile: Profile }) {
  const [rows, setRows] = useState<PlayerMatchRow[] | null>(null)

  useEffect(() => {
    supabase
      .from('match_players')
      .select('status, match:matches!inner(id, title, status, created_at, finished_at, winner:profiles!matches_winner_id_fkey(name))')
      .eq('player_id', profile.id)
      .then(({ data }) => setRows((data as unknown as PlayerMatchRow[]) ?? []))
  }, [profile.id])

  if (!rows) return <PageLoader />

  const finished = rows
    .filter((r) => r.match.status === 'finished')
    .sort((a, b) => (b.match.finished_at ?? '').localeCompare(a.match.finished_at ?? ''))
  const active = rows.filter((r) => r.match.status === 'open' || r.match.status === 'ongoing')
  const played = finished.length
  const wins = finished.filter((r) => r.status === 'winner').length
  const rate = winRate(wins, played)

  return (
    <div className="space-y-5">
      <Greeting profile={profile} subtitle="Statistik kamu" />

      <Card className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-6 -right-4 text-[120px] leading-none text-white/[0.03]">♠</div>
        <div className="flex items-center gap-5">
          <WinRateRing value={rate} />
          <div className="grid flex-1 grid-cols-2 gap-3">
            <Stat label="Match dimainkan" value={played} />
            <Stat label="Match menang" value={wins} accent />
          </div>
        </div>
      </Card>

      {active.length > 0 && (
        <section>
          <SectionTitle>Match aktif kamu</SectionTitle>
          <div className="space-y-2">
            {active.map((r) => (
              <Link key={r.match.id} to={`/matches/${r.match.id}`} className="block">
                <Card className="flex items-center justify-between border-gold-400/30 transition hover:bg-felt-700/80">
                  <span className="font-semibold">{r.match.title}</span>
                  <StatusBadge status={r.match.status} />
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionTitle>Riwayat match</SectionTitle>
        {finished.length === 0 ? (
          <Card>
            <EmptyState icon="🃏" title="Belum ada riwayat" text="Join match dari menu Match untuk mulai mencatat kemenangan." />
          </Card>
        ) : (
          <Card className="divide-y divide-white/5 p-0">
            {finished.map((r) => {
              const won = r.status === 'winner'
              return (
                <Link
                  key={r.match.id}
                  to={`/matches/${r.match.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition hover:bg-white/5"
                >
                  <span
                    className={cx(
                      'flex size-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold',
                      won ? 'bg-gold-400 text-felt-950' : 'bg-white/8 text-slate-400',
                    )}
                  >
                    {won ? 'WIN' : 'OUT'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{r.match.title}</p>
                    <p className="truncate text-xs text-slate-400">
                      {r.match.finished_at && formatDate(r.match.finished_at)}
                      {!won && r.match.winner && ` · Pemenang: ${r.match.winner.name}`}
                    </p>
                  </div>
                  <Chevron />
                </Link>
              )
            })}
          </Card>
        )}
      </section>
    </div>
  )
}

interface DealerMatchRow {
  id: string
  title: string
  status: MatchStatus
  created_at: string
  finished_at: string | null
  winner: { name: string } | null
  players: { count: number }[]
}

function DealerHome({ profile }: { profile: Profile }) {
  const [rows, setRows] = useState<DealerMatchRow[] | null>(null)

  useEffect(() => {
    supabase
      .from('matches')
      .select('id, title, status, created_at, finished_at, winner:profiles!matches_winner_id_fkey(name), players:match_players(count)')
      .eq('dealer_id', profile.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setRows((data as unknown as DealerMatchRow[]) ?? []))
  }, [profile.id])

  if (!rows) return <PageLoader />

  const hosted = rows.filter((m) => m.status === 'finished').length
  const active = rows.filter((m) => m.status === 'open' || m.status === 'ongoing')
  const history = rows.filter((m) => m.status === 'finished' || m.status === 'cancelled')

  return (
    <div className="space-y-5">
      <Greeting profile={profile} subtitle="Panel dealer" />

      <Card className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-6 -right-4 text-[120px] leading-none text-white/[0.03]">♦</div>
        <p className="text-sm text-slate-400">Match yang sudah di-host</p>
        <p className="mt-1 text-5xl font-extrabold text-gold-400">{hosted}</p>
      </Card>

      <Link
        to="/dealer/new"
        className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-gold-400 text-base font-bold text-felt-950 shadow-lg shadow-gold-500/20 transition active:scale-[0.98]"
      >
        <span className="text-xl">＋</span> Buat Match Baru
      </Link>

      {active.length > 0 && (
        <section>
          <SectionTitle>Match aktif</SectionTitle>
          <div className="space-y-2">
            {active.map((m) => (
              <Link key={m.id} to={`/matches/${m.id}`} className="block">
                <Card className="flex items-center justify-between gap-3 border-gold-400/30 transition hover:bg-felt-700/80">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{m.title}</p>
                    <p className="text-xs text-slate-400">{m.players[0]?.count ?? 0} player</p>
                  </div>
                  <StatusBadge status={m.status} />
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionTitle>Riwayat hosting</SectionTitle>
        {history.length === 0 ? (
          <Card>
            <EmptyState icon="🎲" title="Belum ada match selesai" />
          </Card>
        ) : (
          <Card className="divide-y divide-white/5 p-0">
            {history.map((m) => (
              <Link key={m.id} to={`/matches/${m.id}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-white/5">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{m.title}</p>
                  <p className="truncate text-xs text-slate-400">
                    {formatDate(m.finished_at ?? m.created_at)}
                    {m.winner ? ` · 🏆 ${m.winner.name}` : m.status === 'cancelled' ? ' · Dibatalkan' : ''}
                  </p>
                </div>
                <Chevron />
              </Link>
            ))}
          </Card>
        )}
      </section>
    </div>
  )
}

function Greeting({ profile, subtitle }: { profile: Profile; subtitle: string }) {
  return (
    <div className="flex items-center gap-3">
      <Avatar name={profile.name} id={profile.id} size="lg" />
      <div className="min-w-0">
        <p className="text-sm text-slate-400">{subtitle}</p>
        <h1 className="truncate text-2xl font-bold">Halo, {profile.name.split(' ')[0]}!</h1>
      </div>
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-xl bg-felt-950/50 p-3">
      <p className={cx('text-3xl font-extrabold', accent && 'text-gold-400')}>{value}</p>
      <p className="mt-0.5 text-xs leading-tight text-slate-400">{label}</p>
    </div>
  )
}

function WinRateRing({ value }: { value: number }) {
  const r = 40
  const c = 2 * Math.PI * r
  return (
    <div className="relative size-28 shrink-0">
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeWidth="9" className="text-white/8" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * value) / 100}
          className="text-gold-400 transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-extrabold">{value}%</span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Win rate</span>
      </div>
    </div>
  )
}

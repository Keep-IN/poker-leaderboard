import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { DealerDuelSections, PlayerDuelSections } from '../components/DuelSections'
import { DealerMissions, PlayerMissions } from '../components/MissionSections'
import { ACTIVE_DUEL_STATUSES, DUEL_SELECT, type Duel, type DuelStatus } from '../lib/duels'
import { Avatar, Card, Chevron, EmptyState, PageLoader, SectionTitle, StatusBadge, cx } from '../components/ui'
import { useAuth } from '../lib/auth'
import { formatDate, winRate } from '../lib/format'
import { MATCH_CREATION_COST, supabase, type MatchStatus, type PlayerStatus, type Profile } from '../lib/supabase'

export default function Home() {
  const { profile } = useAuth()
  if (!profile) return <PageLoader />
  return profile.role === 'dealer' ? <DealerHome profile={profile} /> : <PlayerHome profile={profile} />
}

interface PlayerMatchRow {
  status: PlayerStatus
  placement: number | null
  points: number
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
  const [hosted, setHosted] = useState<DealerMatchRow[]>([])

  useEffect(() => {
    supabase
      .from('matches')
      .select('id, title, status, created_at, finished_at, winner:profiles!matches_winner_id_fkey(name), players:match_players(count)')
      .eq('dealer_id', profile.id)
      .in('status', ['open', 'ongoing'])
      .order('created_at', { ascending: false })
      .then(({ data }) => setHosted((data as unknown as DealerMatchRow[]) ?? []))
  }, [profile.id])

  return (
    <div className="space-y-5">
      <Greeting profile={profile} subtitle="Statistik kamu" />
      <PlayerStats playerId={profile.id} isMe>
        <PlayerDuelSections me={profile.id} />
        <PlayerMissions me={profile.id} />
      </PlayerStats>

      {hosted.length > 0 && (
        <section>
          <SectionTitle>Match yang kamu host</SectionTitle>
          <div className="grid gap-2 md:grid-cols-2">
            {hosted.map((m) => (
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

      <Link
        to="/matches/new"
        className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-gold-400/50 md:w-fit md:px-8 text-sm font-bold text-gold-300 transition hover:bg-gold-400/10 active:scale-[0.98]"
      >
        <span className="text-lg">＋</span> Buat Match ({MATCH_CREATION_COST} poin)
      </Link>
    </div>
  )
}

/**
 * Stat card, active matches and match history for one player. Used on Beranda and on a player's profile.
 * `children` render right below the stat card (duel invites and missions on Beranda).
 */
export function PlayerStats({ playerId, isMe, children }: { playerId: string; isMe?: boolean; children?: ReactNode }) {
  const [rows, setRows] = useState<PlayerMatchRow[] | null>(null)
  const [adjustments, setAdjustments] = useState<Adjustment[]>([])
  const [duels, setDuels] = useState<Duel[]>([])
  const [tab, setTab] = useState<'match' | 'duel'>('match')

  useEffect(() => {
    supabase
      .from('match_players')
      .select('status, placement, points, match:matches!inner(id, title, status, created_at, finished_at, winner:profiles!matches_winner_id_fkey(name))')
      .eq('player_id', playerId)
      .then(({ data }) => setRows((data as unknown as PlayerMatchRow[]) ?? []))
    supabase
      .from('point_adjustments')
      .select('amount, created_at, counts_monthly, reason, duel:duels(status)')
      .eq('player_id', playerId)
      .then(({ data }) => setAdjustments((data as unknown as Adjustment[]) ?? []))
    supabase
      .from('duels')
      .select(DUEL_SELECT)
      .eq('status', 'finished')
      .or(`challenger_id.eq.${playerId},opponent_id.eq.${playerId}`)
      .order('finished_at', { ascending: false })
      .then(({ data }) => setDuels((data as unknown as Duel[]) ?? []))
  }, [playerId])

  if (!rows) return <PageLoader />

  const finished = rows
    .filter((r) => r.match.status === 'finished')
    .sort((a, b) => (b.match.finished_at ?? '').localeCompare(a.match.finished_at ?? ''))
  const active = rows.filter((r) => r.match.status === 'open' || r.match.status === 'ongoing')
  const played = finished.length
  const wins = finished.filter((r) => r.status === 'winner').length
  const rate = winRate(wins, played)
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const totalPoints =
    finished.reduce((sum, r) => sum + r.points, 0) + adjustments.reduce((sum, a) => sum + a.amount, 0)
  const spent = -adjustments.filter((a) => a.reason === 'create_match').reduce((sum, a) => sum + a.amount, 0)
  const held = -adjustments
    .filter((a) => a.reason === 'duel_stake' && a.duel && ACTIVE_DUEL_STATUSES.includes(a.duel.status))
    .reduce((sum, a) => sum + a.amount, 0)
  const missionRewards = adjustments.filter((a) => a.reason === 'mission_reward').reduce((sum, a) => sum + a.amount, 0)
  const duelWins = duels.filter((d) => d.winner_id === playerId).length
  const showDuels = tab === 'duel' && duels.length > 0
  const monthPoints =
    finished.filter((r) => (r.match.finished_at ?? '') >= monthStart).reduce((sum, r) => sum + r.points, 0) +
    adjustments.filter((a) => a.counts_monthly && a.created_at >= monthStart).reduce((sum, a) => sum + a.amount, 0)

  return (
    <div className="space-y-5 md:grid md:grid-cols-2 md:items-start md:gap-6 md:space-y-0">
      <div className={cx('space-y-5', !children && 'md:sticky md:top-24')}>
      {duels.length > 0 && (
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-felt-950/60 p-1">
          {(['match', 'duel'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cx(
                'min-h-9 rounded-lg text-sm font-semibold transition',
                tab === t ? 'bg-gold-400 text-felt-950' : 'text-slate-400 hover:text-slate-200',
              )}
            >
              {t === 'match' ? '🃏 Match' : '⚔️ Duel'}
            </button>
          ))}
        </div>
      )}

      <Card className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-6 -right-4 text-[120px] leading-none text-white/[0.03]">
          {showDuels ? '⚔' : '♠'}
        </div>
        <div className="flex items-center gap-5">
          <WinRateRing value={showDuels ? winRate(duelWins, duels.length) : rate} />
          <div className="grid flex-1 grid-cols-2 gap-3">
            <Stat label={showDuels ? 'Duel dimainkan' : 'Match dimainkan'} value={showDuels ? duels.length : played} />
            <Stat label={showDuels ? 'Duel menang' : 'Match menang'} value={showDuels ? duelWins : wins} />
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Stat label="Poin bulan ini" value={monthPoints} accent />
          <Stat label="Total poin" value={totalPoints} accent />
        </div>
        {(spent > 0 || held > 0 || missionRewards > 0) && (
          <p className="mt-2 text-center text-[11px] text-slate-500">
            {[
              spent > 0 && `Sudah dikurangi ${spent} poin untuk membuat match`,
              held > 0 && `${held} poin ditahan untuk duel`,
              missionRewards > 0 && `+${missionRewards} poin dari misi`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
      </Card>
      {children}
      </div>

      <div className="space-y-5">
      {showDuels ? (
        <section>
          <SectionTitle>Riwayat duel</SectionTitle>
          <Card className="divide-y divide-white/5 p-0">
            {duels.map((d) => {
              const won = d.winner_id === playerId
              const foe = d.challenger_id === playerId ? d.opponent : d.challenger
              return (
                <div key={d.id} className="flex items-center gap-3 px-4 py-3">
                  <span
                    className={cx(
                      'flex size-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold',
                      won ? 'bg-gold-400 text-felt-950' : 'bg-white/8 text-slate-400',
                    )}
                  >
                    {won ? 'WIN' : 'LOSE'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">vs {foe?.name ?? 'Player'}</p>
                    <p className="truncate text-xs text-slate-400">
                      {d.finished_at && formatDate(d.finished_at)} · Dealer {d.dealer?.name ?? '-'}
                    </p>
                  </div>
                  <span className={cx('shrink-0 text-sm font-bold', won ? 'text-gold-400' : 'text-red-300')}>
                    {won ? '+' : '−'}
                    {d.stake}
                  </span>
                </div>
              )
            })}
          </Card>
        </section>
      ) : (
      <>
      {active.length > 0 && (
        <section>
          <SectionTitle>{isMe ? 'Match aktif kamu' : 'Sedang main'}</SectionTitle>
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
            <EmptyState
              icon="🃏"
              title="Belum ada riwayat"
              text={isMe ? 'Join match dari menu Match untuk mulai mencatat kemenangan.' : 'Pemain ini belum menyelesaikan match.'}
            />
          </Card>
        ) : (
          <Card className="divide-y divide-white/5 p-0">
            {finished.map((r) => {
              const won = r.status === 'winner'
              const podium = r.placement === 2 || r.placement === 3
              return (
                <Link
                  key={r.match.id}
                  to={`/matches/${r.match.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition hover:bg-white/5"
                >
                  <span
                    className={cx(
                      'flex size-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold',
                      won ? 'bg-gold-400 text-felt-950' : podium ? 'bg-slate-300/20 text-slate-200' : 'bg-white/8 text-slate-400',
                    )}
                  >
                    {won ? 'WIN' : podium ? `#${r.placement}` : 'OUT'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{r.match.title}</p>
                    <p className="truncate text-xs text-slate-400">
                      {r.match.finished_at && formatDate(r.match.finished_at)}
                      {!won && r.match.winner && ` · Pemenang: ${r.match.winner.name}`}
                    </p>
                  </div>
                  {r.points > 0 && <span className="shrink-0 text-sm font-bold text-gold-400">+{r.points}</span>}
                  <Chevron />
                </Link>
              )
            })}
          </Card>
        )}
      </section>
      </>
      )}
      </div>
    </div>
  )
}

interface Adjustment {
  amount: number
  created_at: string
  counts_monthly: boolean
  reason: 'create_match' | 'duel_stake' | 'duel_payout' | 'mission_reward'
  duel: { status: DuelStatus } | null
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

      <div className="space-y-5 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
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
      </div>

      <DealerDuelSections me={profile.id} />
      <DealerMissions />

      {active.length > 0 && (
        <section>
          <SectionTitle>Match aktif</SectionTitle>
          <div className="grid gap-2 md:grid-cols-2">
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

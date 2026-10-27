import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import ConfirmSheet, { type Confirmation } from '../components/ConfirmSheet'
import { Avatar, Button, Card, EmptyState, ErrorText, PageLoader, SectionTitle, StatusBadge, cx } from '../components/ui'
import { useAuth } from '../lib/auth'
import { formatDateTime } from '../lib/format'
import { MATCH_CREATION_COST, MIN_MATCH_PLAYERS, errorMessage, pointsFor, supabase, type Match, type MatchPlayer, type Role } from '../lib/supabase'

type MatchWithDealer = Match & { dealer: { name: string; role: Role } | null }

export default function MatchRoom() {
  const { id = '' } = useParams()
  const { profile } = useAuth()
  const [match, setMatch] = useState<MatchWithDealer | null | undefined>(undefined)
  const [players, setPlayers] = useState<MatchPlayer[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState<Confirmation | null>(null)

  const load = useCallback(async () => {
    const [m, p] = await Promise.all([
      supabase.from('matches').select('*, dealer:profiles!matches_dealer_id_fkey(name, role)').eq('id', id).maybeSingle(),
      supabase.from('match_players').select('*, profile:profiles(name)').eq('match_id', id).order('joined_at'),
    ])
    setMatch((m.data as MatchWithDealer | null) ?? null)
    setPlayers((p.data as MatchPlayer[]) ?? [])
  }, [id])

  useEffect(() => {
    load()
    const channel = supabase
      .channel(`match-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `id=eq.${id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_players' }, (payload) => {
        const row = (payload.new && 'match_id' in payload.new ? payload.new : payload.old) as { match_id?: string }
        if (!row?.match_id || row.match_id === id) load()
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [id, load])

  async function call(key: string, fn: string, args: Record<string, unknown>) {
    setBusy(key)
    setError('')
    const { error } = await supabase.rpc(fn, args)
    if (error) setError(errorMessage(error))
    await load()
    setBusy(null)
  }

  if (match === undefined || !profile) return <PageLoader />
  if (match === null)
    return (
      <Card>
        <EmptyState icon="🂠" title="Match tidak ditemukan" />
        <Link to="/matches" className="block text-center text-sm font-semibold text-gold-400">
          Kembali ke daftar match
        </Link>
      </Card>
    )

  const isDealer = match.dealer_id === profile.id
  const hostedByPlayer = match.dealer?.role === 'player'
  const me = players.find((p) => p.player_id === profile.id)
  const full = players.length >= match.max_players
  const stillPlaying = players.filter((p) => p.status === 'playing')
  // Placements come from elimination order, so a winner can only be picked once it is heads-up.
  const canPickWinner = stillPlaying.length <= 2
  const winner = players.find((p) => p.status === 'winner')
  const sorted = [...players].sort(byStanding)
  const nameOf = (p: MatchPlayer) => p.profile?.name ?? 'Player'

  return (
    <div className="space-y-4">
      <Link to="/matches" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200">
        ‹ Semua match
      </Link>

      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl border border-gold-400/20 bg-gradient-to-br from-felt-600 to-felt-800 p-5 shadow-xl">
        <div className="pointer-events-none absolute -right-6 -bottom-10 text-[140px] leading-none text-black/15">♠</div>
        <StatusBadge status={match.status} />
        <h1 className="mt-2 text-2xl font-extrabold">{match.title}</h1>
        <p className="mt-1 text-sm text-slate-300">
          {hostedByPlayer ? 'Host' : 'Dealer'}: <span className="font-semibold">{match.dealer?.name ?? '-'}</span>
        </p>
        <div className="mt-4 flex gap-4 text-sm">
          <Meta label="Player" value={`${players.length}/${match.max_players}`} />
          {match.status === 'ongoing' && <Meta label="Masih main" value={String(stillPlaying.length)} />}
          {match.finished_at && <Meta label="Selesai" value={formatDateTime(match.finished_at)} />}
        </div>
        {(match.status === 'open' || match.status === 'ongoing') && players.length >= MIN_MATCH_PLAYERS && (
          <p className="mt-3 text-xs text-slate-300">
            Poin dengan {players.length} pemain: 🏆 {pointsFor(1, players.length)} · 🥈 {pointsFor(2, players.length)}
            {pointsFor(3, players.length) > 0 && ` · 🥉 ${pointsFor(3, players.length)}`}
          </p>
        )}
      </div>

      {/* Winner banner */}
      {match.status === 'finished' && winner && (
        <div className="flex items-center gap-4 rounded-2xl border border-gold-400/50 bg-gold-400/10 p-4">
          <span className="text-4xl">🏆</span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-gold-300">Pemenang</p>
            <p className="truncate text-xl font-extrabold">{nameOf(winner)}</p>
          </div>
        </div>
      )}

      <ErrorText>{error}</ErrorText>

      {isDealer && hostedByPlayer && match.status !== 'finished' && match.status !== 'cancelled' && (
        <p className="rounded-xl bg-gold-400/10 px-3 py-2 text-xs text-gold-300">
          Kamu host match ini, jadi kamu yang mengatur jalannya match dan tidak ikut main.
        </p>
      )}

      {/* Player actions */}
      {profile.role === 'player' && !isDealer && match.status === 'open' && (
        me ? (
          <Card className="flex items-center justify-between gap-3">
            <p className="text-sm">
              <span className="font-semibold text-emerald-300">Kamu sudah join.</span>
              <span className="block text-slate-400">Tunggu {hostedByPlayer ? 'host' : 'dealer'} memulai match.</span>
            </p>
            <Button variant="danger" loading={busy === 'leave'} onClick={() => call('leave', 'leave_match', { p_match: id })}>
              Keluar
            </Button>
          </Card>
        ) : (
          <Button
            className="min-h-14 w-full text-base"
            disabled={full}
            loading={busy === 'join'}
            onClick={() => call('join', 'join_match', { p_match: id })}
          >
            {full ? 'Match sudah penuh' : 'Join Match'}
          </Button>
        )
      )}

      {/* Dealer controls */}
      {isDealer && match.status === 'open' && (
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Button
            className="min-h-13 text-base"
            disabled={players.length < MIN_MATCH_PLAYERS}
            loading={busy === 'start'}
            onClick={() => call('start', 'start_match', { p_match: id })}
          >
            {players.length < MIN_MATCH_PLAYERS ? `Butuh min. ${MIN_MATCH_PLAYERS} player` : 'Mulai Match'}
          </Button>
          <Button variant="ghost" className="min-h-13" onClick={() => askCancel()}>
            Batalkan
          </Button>
        </div>
      )}

      {isDealer && match.status === 'ongoing' && stillPlaying.length === 1 && (
        <Button
          className="min-h-14 w-full text-base"
          onClick={() => askWinner(stillPlaying[0])}
        >
          🏆 Tetapkan {nameOf(stillPlaying[0])} sebagai pemenang
        </Button>
      )}

      {isDealer && match.status === 'ongoing' && !canPickWinner && (
        <p className="rounded-xl bg-white/5 px-3 py-2 text-xs text-slate-400">
          Tekan <span className="font-semibold text-red-300">Kalah</span> sesuai urutan pemain tersingkir. Tombol Menang muncul saat
          tersisa 2 pemain.
        </p>
      )}

      {/* Player list */}
      <section>
        <SectionTitle>{match.status === 'finished' ? 'Hasil akhir' : 'Player'}</SectionTitle>
        {players.length === 0 ? (
          <Card>
            <EmptyState icon="🪑" title="Belum ada yang join" text="Player bisa join dari halaman ini." />
          </Card>
        ) : (
          <Card className="divide-y divide-white/5 p-0">
            {sorted.map((p, i) => {
              const out = p.status === 'eliminated' && !(match.status === 'finished' && p.points > 0)
              return (
              <div key={p.player_id} className={cx('px-4 py-3', p.player_id === profile.id && 'bg-gold-400/8')}>
              <div className={cx('flex items-center gap-3', out && 'opacity-60')}>
                <span className="w-5 text-center text-xs font-bold text-slate-500">{i + 1}</span>
                <Avatar name={nameOf(p)} id={p.player_id} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-baseline gap-1.5 font-medium">
                    <span className={cx('truncate', out && 'line-through decoration-slate-500')}>{nameOf(p)}</span>
                    {p.player_id === profile.id && <span className="shrink-0 text-xs text-gold-300">(kamu)</span>}
                  </p>
                  <PlayerStatusLabel player={p} matchStatus={match.status} />
                </div>

                {match.status === 'finished' && p.points > 0 && (
                  <span className="shrink-0 rounded-lg bg-gold-400/15 px-2 py-1 text-xs font-bold text-gold-300">+{p.points} poin</span>
                )}

                {isDealer && match.status === 'open' && (
                  <SmallButton
                    tone="ghost"
                    loading={busy === `kick-${p.player_id}`}
                    onClick={() => call(`kick-${p.player_id}`, 'kick_player', { p_match: id, p_player: p.player_id })}
                  >
                    Keluarkan
                  </SmallButton>
                )}

                {isDealer && match.status === 'ongoing' && p.status === 'eliminated' && (
                  <SmallButton
                    tone="ghost"
                    loading={busy === `back-${p.player_id}`}
                    onClick={() => call(`back-${p.player_id}`, 'revive_player', { p_match: id, p_player: p.player_id })}
                  >
                    Undo
                  </SmallButton>
                )}
              </div>

              {isDealer && match.status === 'ongoing' && p.status === 'playing' && (
                <div className={cx('mt-2.5 grid gap-2 pl-8', canPickWinner ? 'grid-cols-2' : 'grid-cols-1')}>
                  <SmallButton
                    tone="danger"
                    loading={busy === `out-${p.player_id}`}
                    onClick={() => call(`out-${p.player_id}`, 'eliminate_player', { p_match: id, p_player: p.player_id })}
                  >
                    ✕ Kalah
                  </SmallButton>
                  {canPickWinner && (
                    <SmallButton tone="gold" onClick={() => askWinner(p)}>
                      🏆 Menang
                    </SmallButton>
                  )}
                </div>
              )}
              </div>
              )
            })}
          </Card>
        )}
      </section>

      {isDealer && match.status === 'ongoing' && (
        <Button variant="ghost" className="w-full text-slate-400" onClick={() => askCancel()}>
          Batalkan match
        </Button>
      )}

      {match.status === 'ongoing' && !isDealer && (
        <p className="text-center text-xs text-slate-500">Halaman ini update otomatis secara real-time.</p>
      )}

      {confirm && (
        <ConfirmSheet
          {...confirm}
          loading={busy === 'confirm'}
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            setBusy('confirm')
            await confirm.run()
            setBusy(null)
            setConfirm(null)
          }}
        />
      )}
    </div>
  )

  function askWinner(p: MatchPlayer) {
    const runnerUp = stillPlaying.find((x) => x.player_id !== p.player_id)
    const [first, second] = [pointsFor(1, players.length), pointsFor(2, players.length)]
    setConfirm({
      title: `${nameOf(p)} menang?`,
      text:
        `${nameOf(p)} juara (+${first} poin)` +
        (runnerUp ? ` dan ${nameOf(runnerUp)} runner-up 1 (+${second} poin)` : '') +
        '. Peringkat lainnya mengikuti urutan kalah. Aksi ini tidak bisa dibatalkan.',
      action: '🏆 Ya, tetapkan pemenang',
      run: () => call('confirm', 'declare_winner', { p_match: id, p_player: p.player_id }),
    })
  }

  function askCancel() {
    setConfirm({
      title: 'Batalkan match?',
      text:
        'Match tidak akan dihitung di statistik maupun leaderboard.' +
        (hostedByPlayer ? ` ${MATCH_CREATION_COST} poin yang dipakai untuk membuat match ini akan dikembalikan.` : ''),
      action: 'Ya, batalkan',
      danger: true,
      run: () => call('confirm', 'cancel_match', { p_match: id }),
    })
  }
}

const standingOrder = { winner: 0, playing: 1, eliminated: 2 }

function byStanding(a: MatchPlayer, b: MatchPlayer) {
  if (a.placement && b.placement) return a.placement - b.placement
  const diff = standingOrder[a.status] - standingOrder[b.status]
  if (diff !== 0) return diff
  // Eliminated later = better finish
  if (a.status === 'eliminated') return (b.eliminated_at ?? '').localeCompare(a.eliminated_at ?? '')
  return a.joined_at.localeCompare(b.joined_at)
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-slate-400">{label}</p>
      <p className="font-bold">{value}</p>
    </div>
  )
}

function PlayerStatusLabel({ player, matchStatus }: { player: MatchPlayer; matchStatus: Match['status'] }) {
  const { status, placement } = player
  if (matchStatus === 'open') return <p className="text-xs text-sky-300">Sudah join</p>
  if (status === 'winner') return <p className="text-xs font-semibold text-gold-400">🏆 Juara</p>
  if (matchStatus === 'finished' && (placement === 2 || placement === 3))
    return <p className="text-xs font-semibold text-slate-200">{placement === 2 ? '🥈 Runner-up 1' : '🥉 Runner-up 2'}</p>
  if (status === 'eliminated') return <p className="text-xs text-red-300">Kalah</p>
  return <p className="text-xs text-emerald-300">Masih main</p>
}

function SmallButton({
  tone,
  loading,
  onClick,
  children,
}: {
  tone: 'gold' | 'danger' | 'ghost'
  loading?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Button
      variant={tone}
      loading={loading}
      onClick={onClick}
      className="min-h-9 rounded-lg px-3 text-xs"
    >
      {children}
    </Button>
  )
}

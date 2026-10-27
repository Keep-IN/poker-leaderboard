import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, Chevron, EmptyState, PageLoader, SectionTitle, StatusBadge } from '../components/ui'
import { useAuth } from '../lib/auth'
import { formatDateTime } from '../lib/format'
import { supabase, type MatchStatus } from '../lib/supabase'

interface MatchListRow {
  id: string
  title: string
  status: MatchStatus
  max_players: number
  created_at: string
  finished_at: string | null
  dealer: { name: string; role: string } | null
  winner: { name: string } | null
  players: { count: number }[]
}

const SELECT =
  'id, title, status, max_players, created_at, finished_at, dealer:profiles!matches_dealer_id_fkey(name, role), winner:profiles!matches_winner_id_fkey(name), players:match_players(count)'

export default function Matches() {
  const { profile } = useAuth()
  const [active, setActive] = useState<MatchListRow[] | null>(null)
  const [recent, setRecent] = useState<MatchListRow[]>([])

  const load = useCallback(async () => {
    const [a, r] = await Promise.all([
      supabase.from('matches').select(SELECT).in('status', ['open', 'ongoing']).order('created_at', { ascending: false }),
      supabase.from('matches').select(SELECT).eq('status', 'finished').order('finished_at', { ascending: false }).limit(10),
    ])
    setActive((a.data as unknown as MatchListRow[]) ?? [])
    setRecent((r.data as unknown as MatchListRow[]) ?? [])
  }, [])

  useEffect(() => {
    load()
    const channel = supabase
      .channel('matches-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_players' }, load)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [load])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Match</h1>
        {profile && (
          <Link
            to="/matches/new"
            className="inline-flex min-h-10 items-center gap-1 rounded-xl bg-gold-400 px-3 text-sm font-bold text-felt-950"
          >
            ＋ Buat
          </Link>
        )}
      </div>

      <section>
        <SectionTitle>Sedang aktif</SectionTitle>
        {!active ? (
          <PageLoader />
        ) : active.length === 0 ? (
          <Card>
            <EmptyState
              icon="♣"
              title="Belum ada match aktif"
              text={profile?.role === 'dealer' ? 'Buat match baru supaya player bisa join.' : 'Tunggu dealer membuat match, atau buat sendiri pakai 1 poin.'}
            />
          </Card>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {active.map((m) => (
              <MatchCard key={m.id} m={m} />
            ))}
          </div>
        )}
      </section>

      {recent.length > 0 && (
        <section>
          <SectionTitle>Baru selesai</SectionTitle>
          <Card className="divide-y divide-white/5 p-0">
            {recent.map((m) => (
              <Link key={m.id} to={`/matches/${m.id}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-white/5">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{m.title}</p>
                  <p className="truncate text-xs text-slate-400">
                    🏆 {m.winner?.name ?? '-'} · {m.finished_at && formatDateTime(m.finished_at)}
                  </p>
                </div>
                <Chevron />
              </Link>
            ))}
          </Card>
        </section>
      )}
    </div>
  )
}

function MatchCard({ m }: { m: MatchListRow }) {
  const count = m.players[0]?.count ?? 0
  return (
    <Link to={`/matches/${m.id}`} className="block">
      <Card className="transition hover:bg-felt-700/80">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">{m.title}</p>
            <p className="text-xs text-slate-400">{m.dealer?.role === 'player' ? 'Host' : 'Dealer'}: {m.dealer?.name ?? '-'}</p>
          </div>
          <StatusBadge status={m.status} />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="flex gap-1">
            {Array.from({ length: m.max_players }, (_, i) => (
              <span key={i} className={i < count ? 'size-2.5 rounded-full bg-gold-400' : 'size-2.5 rounded-full bg-white/10'} />
            ))}
          </div>
          <span className="text-xs text-slate-400">
            {count}/{m.max_players} player
          </span>
        </div>
      </Card>
    </Link>
  )
}

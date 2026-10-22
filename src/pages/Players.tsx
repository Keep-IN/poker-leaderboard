import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Avatar, Card, Chevron, EmptyState, PageLoader, cx } from '../components/ui'
import { useAuth } from '../lib/auth'
import { formatDate, winRate } from '../lib/format'
import { supabase, type Role } from '../lib/supabase'
import { PlayerStats } from './Home'

interface PlayerStatRow {
  player_id: string
  name: string
  played: number
  wins: number
  points: number
  month_points: number
  joined_at: string
}

type SortKey = 'points' | 'month' | 'wins' | 'rate' | 'played' | 'name'

const sortLabels: Record<SortKey, string> = {
  points: 'Total poin',
  month: 'Poin bulan ini',
  wins: 'Menang',
  rate: 'Win rate',
  played: 'Main',
  name: 'Nama',
}

export default function Players() {
  const { profile } = useAuth()
  const [rows, setRows] = useState<PlayerStatRow[] | null>(null)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('points')

  useEffect(() => {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    supabase.rpc('get_player_stats', { p_month_start: monthStart }).then(({ data }) =>
      setRows(
        ((data as PlayerStatRow[]) ?? []).map((r) => ({
          ...r,
          played: Number(r.played),
          wins: Number(r.wins),
          points: Number(r.points),
          month_points: Number(r.month_points),
        })),
      ),
    )
  }, [])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = (rows ?? []).filter((r) => r.name.toLowerCase().includes(q))
    const byName = (a: PlayerStatRow, b: PlayerStatRow) => a.name.localeCompare(b.name, 'id')
    const compare: Record<SortKey, (a: PlayerStatRow, b: PlayerStatRow) => number> = {
      points: (a, b) => b.points - a.points || b.wins - a.wins || byName(a, b),
      month: (a, b) => b.month_points - a.month_points || b.points - a.points || byName(a, b),
      wins: (a, b) => b.wins - a.wins || b.played - a.played || byName(a, b),
      rate: (a, b) => winRate(b.wins, b.played) - winRate(a.wins, a.played) || b.played - a.played || byName(a, b),
      played: (a, b) => b.played - a.played || b.wins - a.wins || byName(a, b),
      name: byName,
    }
    return [...list].sort(compare[sort])
  }, [rows, query, sort])

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Pemain</h1>
        {rows && <span className="text-sm text-slate-400">{rows.length} terdaftar</span>}
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Cari nama pemain…"
        className="h-11 w-full rounded-xl border border-white/10 bg-felt-950/60 px-4 text-base outline-none placeholder:text-slate-500 focus:border-gold-400/70 focus:ring-2 focus:ring-gold-400/20"
      />

      <div className="flex gap-1.5 overflow-x-auto">
        {(Object.keys(sortLabels) as SortKey[]).map((key) => (
          <button
            key={key}
            onClick={() => setSort(key)}
            className={cx(
              'shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition',
              sort === key ? 'bg-gold-400 text-felt-950' : 'bg-white/5 text-slate-300 hover:bg-white/10',
            )}
          >
            {sortLabels[key]}
          </button>
        ))}
      </div>

      {!rows ? (
        <PageLoader />
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState icon="🔍" title={rows.length === 0 ? 'Belum ada pemain' : 'Pemain tidak ditemukan'} />
        </Card>
      ) : (
        <Card className="divide-y divide-white/5 p-0">
          {visible.map((r) => (
            <Link
              key={r.player_id}
              to={`/players/${r.player_id}`}
              className={cx(
                'flex items-center gap-3 px-4 py-3 transition hover:bg-white/5',
                r.player_id === profile?.id && 'bg-gold-400/8',
              )}
            >
              <Avatar name={r.name} id={r.player_id} />
              <div className="min-w-0 flex-1">
                <p className="flex items-baseline gap-1.5 font-medium">
                  <span className="truncate">{r.name}</span>
                  {r.player_id === profile?.id && <span className="shrink-0 text-xs text-gold-300">(kamu)</span>}
                </p>
                <p className="text-xs text-slate-400">
                  {r.played} main · {r.wins} menang · {winRate(r.wins, r.played)}%
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg leading-none font-extrabold text-gold-400">{sort === 'month' ? r.month_points : r.points}</p>
                <p className="text-[10px] uppercase tracking-wider text-slate-400">{sort === 'month' ? 'bln ini' : 'poin'}</p>
              </div>
              <Chevron />
            </Link>
          ))}
        </Card>
      )}
    </div>
  )
}

interface PublicProfile {
  id: string
  name: string
  role: Role
  created_at: string
}

export function PlayerProfile() {
  const { id = '' } = useParams()
  const { profile: me } = useAuth()
  const [player, setPlayer] = useState<PublicProfile | null | undefined>(undefined)

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, name, role, created_at')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => setPlayer((data as PublicProfile | null) ?? null))
  }, [id])

  if (player === undefined) return <PageLoader />

  return (
    <div className="space-y-5">
      <Link to="/players" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200">
        ‹ Semua pemain
      </Link>

      {player === null ? (
        <Card>
          <EmptyState icon="👤" title="Pemain tidak ditemukan" />
        </Card>
      ) : (
        <>
          <div className="flex items-center gap-4">
            <Avatar name={player.name} id={player.id} size="xl" />
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold">
                {player.name}
                {player.id === me?.id && <span className="ml-2 text-sm font-medium text-gold-300">(kamu)</span>}
              </h1>
              <p className="text-sm text-slate-400">
                {player.role === 'dealer' ? 'Dealer · ' : ''}Bergabung {formatDate(player.created_at)}
              </p>
            </div>
          </div>
          <PlayerStats playerId={player.id} isMe={player.id === me?.id} />
        </>
      )}
    </div>
  )
}

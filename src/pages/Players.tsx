import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Avatar, Button, Card, Chevron, EmptyState, PageLoader, SectionTitle, cx } from '../components/ui'
import { useAuth } from '../lib/auth'
import { LEDGER_LABELS, MILESTONES, PODIUM_TITLES, useCoins, usePodiumRank, type LedgerRow } from '../lib/coins'
import { formatDate, winRate } from '../lib/format'
import { errorMessage, supabase, type Role } from '../lib/supabase'
import { useTheme } from '../lib/theme'
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

      <div className="space-y-4 md:flex md:items-center md:gap-4 md:space-y-0">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Cari nama pemain…"
        className="h-11 w-full rounded-xl border md:max-w-xs border-ink/10 bg-surface-950/60 px-4 text-base outline-none placeholder:text-slate-500 focus:border-brand-400/70 focus:ring-2 focus:ring-brand-400/20"
      />

      <div className="flex gap-1.5 overflow-x-auto">
        {(Object.keys(sortLabels) as SortKey[]).map((key) => (
          <button
            key={key}
            onClick={() => setSort(key)}
            className={cx(
              'shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition',
              sort === key ? 'bg-brand-400 text-on-accent' : 'bg-ink/5 text-slate-300 hover:bg-ink/10',
            )}
          >
            {sortLabels[key]}
          </button>
        ))}
      </div>
      </div>

      {!rows ? (
        <PageLoader />
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState icon="🔍" title={rows.length === 0 ? 'Belum ada pemain' : 'Pemain tidak ditemukan'} />
        </Card>
      ) : (
        <Card className="divide-y divide-ink/5 p-0 md:grid md:grid-cols-2 md:divide-y-0">
          {visible.map((r) => (
            <div key={r.player_id} className={cx('flex items-center md:border-b md:border-ink/5 md:odd:border-r', r.player_id === profile?.id && 'bg-brand-400/8')}>
            <Link
              to={`/players/${r.player_id}`}
              className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 transition hover:bg-ink/5"
            >
              <Avatar name={r.name} id={r.player_id} />
              <div className="min-w-0 flex-1">
                <p className="flex items-baseline gap-1.5 font-medium">
                  <span className="truncate">{r.name}</span>
                  {r.player_id === profile?.id && <span className="shrink-0 text-xs text-brand-300">(kamu)</span>}
                </p>
                <p className="text-xs text-slate-400">
                  {r.played} main · {r.wins} menang · {winRate(r.wins, r.played)}%
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg leading-none font-extrabold text-brand-400">{sort === 'month' ? r.month_points : r.points}</p>
                <p className="text-[10px] uppercase tracking-wider text-slate-400">{sort === 'month' ? 'bln ini' : 'poin'}</p>
              </div>
            </Link>
            {profile?.role === 'player' && r.player_id !== profile.id ? (
              <Link
                to={`/duel/${r.player_id}`}
                aria-label={`Ajak ${r.name} duel`}
                className="mx-2 flex size-10 shrink-0 items-center justify-center rounded-xl bg-ink/5 text-lg transition hover:bg-brand-400/15"
              >
                ⚔️
              </Link>
            ) : (
              <span className="mx-2 flex size-10 shrink-0 items-center justify-center">
                <Chevron />
              </span>
            )}
            </div>
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

export function PlayerProfile({ self }: { self?: boolean }) {
  const params = useParams()
  const { profile: me } = useAuth()
  const id = self ? me?.id ?? '' : params.id ?? ''
  const [player, setPlayer] = useState<PublicProfile | null | undefined>(undefined)
  const [total, setTotal] = useState<number | null>(null)
  const rank = usePodiumRank(id)

  useEffect(() => {
    if (!id) return
    supabase
      .from('profiles')
      .select('id, name, role, created_at')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => setPlayer((data as PublicProfile | null) ?? null))
    supabase.rpc('get_player_stats').then(({ data }) => {
      const row = ((data as PlayerStatRow[]) ?? []).find((r) => r.player_id === id)
      setTotal(row ? Number(row.points) : 0)
    })
  }, [id])

  if (player === undefined) return <PageLoader />
  const isMe = player?.id === me?.id

  return (
    <div className="space-y-5">
      {!self && (
        <Link to="/players" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200">
          ‹ Semua pemain
        </Link>
      )}

      {player === null ? (
        <Card>
          <EmptyState icon="👤" title="Pemain tidak ditemukan" />
        </Card>
      ) : (
        <>
          <div className="flex items-center gap-4">
            <Avatar name={player.name} id={player.id} size="xl" />
            <div className="min-w-0">
              {rank > 0 && (
                <p className={cx('pod-wrap mb-1 inline-flex', `pod-${rank}`)}>
                  <span className="pod-title inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider">
                    {rank === 1 ? '👑' : rank === 2 ? '🥈' : '🥉'} {PODIUM_TITLES[rank]} · #{rank} all time
                  </span>
                </p>
              )}
              <h1 className="truncate text-2xl font-bold">
                {player.name}
                {isMe && !self && <span className="ml-2 text-sm font-medium text-brand-300">(kamu)</span>}
              </h1>
              <p className="text-sm text-slate-400">
                {player.role === 'dealer' ? 'Dealer · ' : ''}Bergabung {formatDate(player.created_at)}
              </p>
            </div>
          </div>
          {me?.role === 'player' && player.role === 'player' && !isMe && (
            <Link
              to={`/duel/${player.id}`}
              className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-brand-400/50 md:w-fit md:px-8 text-sm font-bold text-brand-300 transition hover:bg-brand-400/10 active:scale-[0.98]"
            >
              ⚔️ Ajak {player.name.split(' ')[0]} duel
            </Link>
          )}
          {isMe && player.role === 'player' && <MyCoins />}
          {player.role === 'player' && total !== null && <Achievements total={total} />}
          {player.role === 'player' && <PlayerStats playerId={player.id} isMe={isMe} />}
          {isMe && <Settings name={player.name} onRenamed={(name) => setPlayer({ ...player, name })} />}
        </>
      )}
    </div>
  )
}

function Achievements({ total }: { total: number }) {
  return (
    <section>
      <SectionTitle>🏅 Pencapaian total poin</SectionTitle>
      <div className="grid grid-cols-4 gap-2">
        {MILESTONES.map((m) => {
          const on = total >= m.points
          return (
            <div key={m.points} className={cx('rounded-xl border p-2 text-center', on ? 'border-brand-400/50 bg-brand-400/10' : 'border-ink/10 opacity-50')}>
              <p className="text-lg">{on ? '🏅' : '🔒'}</p>
              <p className="text-sm font-bold">{m.points}</p>
              <p className="text-[10px] text-slate-400">poin · +{m.coins} 🪙</p>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function MyCoins() {
  const { balance, claimable, claim } = useCoins()
  const [ledger, setLedger] = useState<LedgerRow[]>([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    supabase.from('coin_ledger').select('*').order('created_at', { ascending: false }).limit(20).then(({ data }) => setLedger((data as LedgerRow[]) ?? []))
  }, [balance])

  async function doClaim() {
    setBusy(true)
    const { got, error } = await claim()
    setBusy(false)
    setMsg(error ? errorMessage(error) : `+${got} koin masuk!`)
  }

  return (
    <section className="space-y-2">
      <SectionTitle>🪙 Koin</SectionTitle>
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-3xl font-extrabold text-amber-300">{balance ?? '…'}</p>
          <p className="text-xs text-slate-400">koin · untuk beli skill card</p>
        </div>
        <div className="flex gap-2">
          <Link to="/inventory" className="rounded-xl border border-ink/10 px-3 py-2 text-sm font-semibold hover:bg-ink/5">
            🎒 Inventory
          </Link>
          <Link to="/market" className="rounded-xl border border-ink/10 px-3 py-2 text-sm font-semibold hover:bg-ink/5">
            🛒 Market
          </Link>
        </div>
      </Card>
      {claimable.length > 0 && (
        <Card className="border-amber-400/40 bg-amber-500/10">
          <p className="font-semibold">Ada koin yang bisa diklaim!</p>
          <ul className="mt-1 space-y-0.5 text-sm text-slate-300">
            {claimable.map((c) => (
              <li key={c.reason + c.ref}>
                • {c.label} <span className="font-bold text-amber-300">+{c.amount}</span>
              </li>
            ))}
          </ul>
          <Button className="mt-3 w-full" loading={busy} onClick={doClaim}>
            🪙 Klaim {claimable.reduce((s, c) => s + c.amount, 0)} koin
          </Button>
        </Card>
      )}
      {msg && <p className="text-center text-sm text-emerald-300">{msg}</p>}
      {ledger.length > 0 && (
        <Card className="divide-y divide-ink/5 p-0">
          {ledger.map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
              <span className="text-slate-300">
                {LEDGER_LABELS[l.reason]}
                <span className="ml-2 text-xs text-slate-500">{formatDate(l.created_at)}</span>
              </span>
              <span className={cx('font-bold', l.amount > 0 ? 'text-amber-300' : 'text-red-300')}>
                {l.amount > 0 ? '+' : ''}
                {l.amount}
              </span>
            </div>
          ))}
        </Card>
      )}
    </section>
  )
}

function Settings({ name, onRenamed }: { name: string; onRenamed: (name: string) => void }) {
  const { pref, choose } = useTheme()
  const [newName, setNewName] = useState(name)
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState('')

  async function rename(e: FormEvent) {
    e.preventDefault()
    setBusy('name')
    const { error } = await supabase.rpc('update_my_name', { p_name: newName.trim() })
    setBusy('')
    setMsg(error ? errorMessage(error) : 'Nama diperbarui.')
    if (!error) onRenamed(newName.trim())
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault()
    if (password.length < 6) return setMsg('Password minimal 6 karakter.')
    setBusy('pw')
    const { error } = await supabase.auth.updateUser({ password })
    setBusy('')
    setPassword('')
    setMsg(error ? errorMessage(error) : 'Password diganti.')
  }

  const field = 'h-11 min-w-0 flex-1 rounded-xl border border-ink/10 bg-surface-950/60 px-3 text-base outline-none focus:border-brand-400/70'
  return (
    <section className="space-y-2">
      <SectionTitle>⚙️ Pengaturan</SectionTitle>
      <Card className="space-y-4">
        <form onSubmit={rename} className="space-y-1.5">
          <span className="block text-sm font-medium text-slate-300">Nama tampilan</span>
          <div className="flex gap-2">
            <input value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={40} className={field} />
            <Button type="submit" loading={busy === 'name'} disabled={!newName.trim() || newName.trim() === name}>
              Simpan
            </Button>
          </div>
        </form>
        <form onSubmit={changePassword} className="space-y-1.5">
          <span className="block text-sm font-medium text-slate-300">Ganti password</span>
          <div className="flex gap-2">
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" placeholder="Password baru (min. 6)" className={field} />
            <Button type="submit" loading={busy === 'pw'} disabled={!password}>
              Ganti
            </Button>
          </div>
        </form>
        <div className="space-y-1.5">
          <span className="block text-sm font-medium text-slate-300">Tema</span>
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-surface-950/60 p-1">
            {(['system', 'light', 'dark'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => choose(t)}
                className={cx('min-h-9 rounded-lg text-sm font-semibold transition', pref === t ? 'bg-brand-400 text-on-accent' : 'text-slate-400 hover:text-slate-200')}
              >
                {t === 'system' ? 'Ikut sistem' : t === 'light' ? 'Terang' : 'Gelap'}
              </button>
            ))}
          </div>
        </div>
        {msg && <p className="text-sm text-slate-300">{msg}</p>}
      </Card>
    </section>
  )
}

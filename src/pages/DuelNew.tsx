import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Avatar, Button, Card, EmptyState, ErrorText, PageLoader } from '../components/ui'
import { useAuth } from '../lib/auth'
import { errorMessage, supabase } from '../lib/supabase'

interface Opponent {
  player_id: string
  name: string
  points: number
}

export default function DuelNew() {
  const { opponentId = '' } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [opponent, setOpponent] = useState<Opponent | null | undefined>(undefined)
  const [myPoints, setMyPoints] = useState<number | null>(null)
  const [stake, setStake] = useState(1)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.rpc('get_my_points').then(({ data }) => setMyPoints(Number(data ?? 0)))
    supabase.rpc('get_player_stats').then(({ data }) => {
      const row = ((data as Opponent[]) ?? []).find((r) => r.player_id === opponentId)
      setOpponent(row ? { ...row, points: Number(row.points) } : null)
    })
  }, [opponentId])

  if (!profile || opponent === undefined || myPoints === null) return <PageLoader />

  if (profile.role !== 'player' || opponent === null || opponent.player_id === profile.id)
    return (
      <Card>
        <EmptyState icon="⚔️" title="Duel tidak tersedia" text="Duel hanya bisa antar dua akun player yang berbeda." />
        <Link to="/players" className="block text-center text-sm font-semibold text-gold-400">
          Kembali ke daftar pemain
        </Link>
      </Card>
    )

  // Both stakes are held, so the bet can't exceed what either player has.
  const maxStake = Math.min(myPoints, opponent.points)
  const validStake = stake >= 1 && stake <= maxStake

  async function create() {
    setError('')
    setLoading(true)
    const { error } = await supabase.rpc('create_duel', { p_opponent: opponentId, p_stake: stake })
    setLoading(false)
    if (error) return setError(errorMessage(error))
    navigate('/', { replace: true })
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (validStake) setConfirming(true)
  }

  const header = (
    <div className="flex items-center gap-3">
      <Avatar name={opponent.name} id={opponent.player_id} size="lg" />
      <div className="min-w-0">
        <p className="text-sm text-slate-400">{confirming ? 'Konfirmasi duel' : 'Ajak duel'}</p>
        <h1 className="truncate text-2xl font-bold">⚔️ {opponent.name}</h1>
      </div>
    </div>
  )

  if (confirming)
    return (
      <div className="space-y-4">
        {header}
        <Card className="space-y-4">
          <div className="space-y-2 text-sm">
            <SummaryRow label="Lawan">{opponent.name}</SummaryRow>
            <SummaryRow label="Taruhan">{stake} poin per pemain</SummaryRow>
          </div>
          <div className="rounded-xl bg-felt-950/60 p-4 text-sm">
            <div className="flex items-center gap-2 text-slate-300">
              <span>Total poin kamu</span>
              <span className="font-bold">{myPoints}</span>
              <span className="text-slate-500">→</span>
              <span className="font-bold text-gold-400">{myPoints - stake}</span>
              <span className="text-xs text-slate-500">(ditahan)</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-lg bg-emerald-500/10 py-2">
                <p className="text-xs text-slate-400">Kalau menang</p>
                <p className="text-lg font-extrabold text-emerald-300">+{stake}</p>
              </div>
              <div className="rounded-lg bg-chip-red/10 py-2">
                <p className="text-xs text-slate-400">Kalau kalah</p>
                <p className="text-lg font-extrabold text-red-300">−{stake}</p>
              </div>
            </div>
          </div>
          <ul className="space-y-1.5 text-sm text-slate-300">
            <li>• Taruhan kamu langsung ditahan. {opponent.name} juga harus menerima, lalu dealer menyetujui dan menjadi host.</li>
            <li>• Kalau ajakan ditolak, dibatalkan, atau tidak disetujui dealer, <span className="font-semibold">poin dikembalikan</span>.</li>
            <li>
              • Taruhan diambil dari <span className="font-semibold">poin bulan ini dan total poin</span>. Kalau poin bulan ini
              kurang, sisanya hanya dari total poin, jadi poin bulan ini tidak pernah minus.
            </li>
          </ul>
        </Card>

        <ErrorText>{error}</ErrorText>

        <Button loading={loading} onClick={create} className="min-h-13 w-full text-base">
          ⚔️ Kirim ajakan duel
        </Button>
        <Button variant="ghost" onClick={() => setConfirming(false)} className="w-full" disabled={loading}>
          Kembali
        </Button>
      </div>
    )

  return (
    <div className="space-y-4">
      {header}

      {maxStake < 1 ? (
        <p className="rounded-xl bg-chip-red/15 px-3 py-2 text-sm text-red-300">
          {myPoints < 1
            ? 'Kamu belum punya poin untuk taruhan.'
            : `${opponent.name} belum punya poin, jadi tidak bisa menerima taruhan.`}
        </p>
      ) : (
        <p className="rounded-xl bg-gold-400/10 px-3 py-2 text-sm text-gold-300">
          Total poin kamu {myPoints}, {opponent.name} {opponent.points}. Taruhan maksimal {maxStake} poin.
        </p>
      )}

      <form onSubmit={submit} className="space-y-4">
        <Card className="space-y-4">
          <span className="block text-sm font-medium text-slate-300">Taruhan (poin per pemain)</span>
          <div className="flex items-center justify-between rounded-xl bg-felt-950/60 p-2">
            <StepButton label="−" onClick={() => setStake((n) => Math.max(1, n - 1))} disabled={stake <= 1} />
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={Math.max(1, maxStake)}
              value={stake}
              onChange={(e) => setStake(Math.floor(Number(e.target.value) || 0))}
              aria-label="Jumlah taruhan"
              className="w-24 bg-transparent text-center text-3xl font-extrabold text-gold-400 outline-none"
            />
            <StepButton label="+" onClick={() => setStake((n) => Math.min(maxStake, n + 1))} disabled={stake >= maxStake} />
          </div>
          {maxStake >= 1 && (
            <div className="flex flex-wrap gap-1.5">
              {[1, 5, 10, 25].filter((n) => n < maxStake).concat(maxStake).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setStake(n)}
                  className="rounded-full bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10"
                >
                  {n === maxStake ? `Maks ${n}` : n}
                </button>
              ))}
            </div>
          )}
          {!validStake && maxStake >= 1 && <p className="text-xs text-red-300">Taruhan harus 1 sampai {maxStake} poin.</p>}
        </Card>

        <Button type="submit" disabled={!validStake} className="min-h-13 w-full text-base">
          Lanjut
        </Button>
        <Button type="button" variant="ghost" onClick={() => navigate(-1)} className="w-full">
          Batal
        </Button>
      </form>
    </div>
  )
}

function SummaryRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-400">{label}</span>
      <span className="truncate text-right font-semibold">{children}</span>
    </div>
  )
}

function StepButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="size-12 rounded-xl bg-white/8 text-2xl font-bold text-slate-100 transition hover:bg-white/15 active:scale-95 disabled:opacity-30"
    >
      {label}
    </button>
  )
}

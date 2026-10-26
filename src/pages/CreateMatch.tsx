import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, ErrorText, PageLoader } from '../components/ui'
import { useAuth } from '../lib/auth'
import { formatDate } from '../lib/format'
import { MATCH_CREATION_COST, errorMessage, supabase } from '../lib/supabase'

export default function CreateMatch() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [title, setTitle] = useState(`Poker Night ${formatDate(new Date().toISOString())}`)
  const [maxPlayers, setMaxPlayers] = useState(8)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [balance, setBalance] = useState<number | null>(null)
  const isPlayer = profile?.role === 'player'

  useEffect(() => {
    if (!isPlayer) return
    supabase.rpc('get_my_points').then(({ data }) => setBalance(Number(data ?? 0)))
  }, [isPlayer])

  async function create() {
    setError('')
    setLoading(true)
    const { data, error } = await supabase.rpc('create_match', { p_title: title.trim(), p_max_players: maxPlayers })
    setLoading(false)
    if (error) return setError(errorMessage(error))
    navigate(`/matches/${data}`, { replace: true })
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    // Players pay points to host, so they review the cost on a confirmation step first.
    if (isPlayer) setConfirming(true)
    else create()
  }

  if (!profile || (isPlayer && balance === null)) return <PageLoader />

  const enoughPoints = !isPlayer || (balance ?? 0) >= MATCH_CREATION_COST

  if (confirming && balance !== null)
    return (
      <div className="space-y-4">
        <div>
          <p className="text-sm text-slate-400">Konfirmasi</p>
          <h1 className="text-2xl font-bold">Buat match pakai poin?</h1>
        </div>

        <Card className="space-y-4">
          <div className="space-y-2 text-sm">
            <SummaryRow label="Nama match">{title.trim()}</SummaryRow>
            <SummaryRow label="Maksimal player">{maxPlayers} player</SummaryRow>
          </div>
          <div className="rounded-xl bg-felt-950/60 p-4">
            <p className="text-xs uppercase tracking-wider text-slate-400">Biaya</p>
            <p className="mt-1 text-3xl font-extrabold text-chip-red">−{MATCH_CREATION_COST} poin</p>
            <div className="mt-3 flex items-center gap-2 text-sm text-slate-300">
              <span>Poin kamu</span>
              <span className="font-bold">{balance}</span>
              <span className="text-slate-500">→</span>
              <span className="font-bold text-gold-400">{balance - MATCH_CREATION_COST}</span>
            </div>
          </div>
          <ul className="space-y-1.5 text-sm text-slate-300">
            <li>• Kamu jadi <span className="font-semibold">host</span>: mulai match, tandai pemain kalah, dan tetapkan pemenang.</li>
            <li>• Kamu <span className="font-semibold">tidak bisa ikut main</span> di match buatanmu sendiri.</li>
            <li>• Kalau match dibatalkan, <span className="font-semibold">poin kamu dikembalikan</span>.</li>
          </ul>
        </Card>

        <ErrorText>{error}</ErrorText>

        <Button loading={loading} onClick={create} className="min-h-13 w-full text-base">
          Ya, buat match (−{MATCH_CREATION_COST} poin)
        </Button>
        <Button variant="ghost" onClick={() => setConfirming(false)} className="w-full" disabled={loading}>
          Kembali
        </Button>
      </div>
    )

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-slate-400">{isPlayer ? `Biaya ${MATCH_CREATION_COST} poin` : 'Menu dealer'}</p>
        <h1 className="text-2xl font-bold">Buat Match Baru</h1>
      </div>

      {isPlayer && (
        <div
          className={
            enoughPoints
              ? 'rounded-xl bg-gold-400/10 px-3 py-2 text-sm text-gold-300'
              : 'rounded-xl bg-chip-red/15 px-3 py-2 text-sm text-red-300'
          }
        >
          {enoughPoints
            ? `Poin kamu sekarang ${balance}. Membuat match memakai ${MATCH_CREATION_COST} poin.`
            : `Poin kamu ${balance}. Butuh minimal ${MATCH_CREATION_COST} poin untuk membuat match. Main dan raih peringkat 1–3 dulu ya!`}
        </div>
      )}

      <form onSubmit={submit} className="space-y-4">
        <Card className="space-y-5">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-300">Nama match</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={60}
              required
              className="h-12 w-full rounded-xl border border-white/10 bg-felt-950/60 px-4 text-base outline-none focus:border-gold-400/70 focus:ring-2 focus:ring-gold-400/20"
            />
          </label>

          <div>
            <span className="mb-1.5 block text-sm font-medium text-slate-300">Maksimal player</span>
            <div className="flex items-center justify-between rounded-xl bg-felt-950/60 p-2">
              <StepButton label="−" onClick={() => setMaxPlayers((n) => Math.max(2, n - 1))} disabled={maxPlayers <= 2} />
              <div className="text-center">
                <span className="text-3xl font-extrabold text-gold-400">{maxPlayers}</span>
                <span className="ml-1 text-sm text-slate-400">player</span>
              </div>
              <StepButton label="+" onClick={() => setMaxPlayers((n) => Math.min(8, n + 1))} disabled={maxPlayers >= 8} />
            </div>
          </div>
        </Card>

        <ErrorText>{error}</ErrorText>

        <Button type="submit" loading={loading} disabled={!enoughPoints} className="min-h-13 w-full text-base">
          {isPlayer ? 'Lanjut' : 'Buat Match'}
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

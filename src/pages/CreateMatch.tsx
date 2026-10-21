import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, ErrorText } from '../components/ui'
import { formatDate } from '../lib/format'
import { errorMessage, supabase } from '../lib/supabase'

export default function CreateMatch() {
  const navigate = useNavigate()
  const [title, setTitle] = useState(`Poker Night ${formatDate(new Date().toISOString())}`)
  const [maxPlayers, setMaxPlayers] = useState(8)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { data, error } = await supabase.rpc('create_match', { p_title: title.trim(), p_max_players: maxPlayers })
    setLoading(false)
    if (error) return setError(errorMessage(error))
    navigate(`/matches/${data}`, { replace: true })
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-slate-400">Menu dealer</p>
        <h1 className="text-2xl font-bold">Buat Match Baru</h1>
      </div>

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

        <Button type="submit" loading={loading} className="min-h-13 w-full text-base">
          Buat Match
        </Button>
        <Button type="button" variant="ghost" onClick={() => navigate(-1)} className="w-full">
          Batal
        </Button>
      </form>
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

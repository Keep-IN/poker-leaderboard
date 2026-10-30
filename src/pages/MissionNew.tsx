import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Card, EmptyState, ErrorText, PageLoader } from '../components/ui'
import { useAuth } from '../lib/auth'
import { formatDateTime } from '../lib/format'
import { missionText, useNow } from '../lib/missions'
import { errorMessage, supabase } from '../lib/supabase'

/** datetime-local value (browser local time) for 7 days from now at 23:59. */
function defaultDeadline() {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  d.setHours(23, 59, 0, 0)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function MissionNew() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [wins, setWins] = useState(2)
  const [minStake, setMinStake] = useState(10)
  const [reward, setReward] = useState(15)
  const [deadline, setDeadline] = useState(defaultDeadline)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const now = useNow()

  if (!profile) return <PageLoader />
  if (profile.role !== 'dealer')
    return (
      <Card className="md:mx-auto md:max-w-xl">
        <EmptyState icon="🎯" title="Khusus dealer" text="Hanya dealer yang bisa membuat misi." />
        <Link to="/" className="block text-center text-sm font-semibold text-gold-400">
          Kembali ke beranda
        </Link>
      </Card>
    )

  const deadlineDate = new Date(deadline)
  const validDeadline = !Number.isNaN(deadlineDate.getTime()) && deadlineDate.getTime() > now + 5 * 60_000

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!validDeadline) return setError('Deadline harus di masa depan.')
    setError('')
    setLoading(true)
    const { error } = await supabase.rpc('create_mission', {
      p_wins: wins,
      p_min_stake: minStake,
      p_reward: reward,
      p_deadline: deadlineDate.toISOString(),
    })
    setLoading(false)
    if (error) return setError(errorMessage(error))
    navigate('/', { replace: true })
  }

  return (
    <div className="space-y-4 md:mx-auto md:max-w-xl">
      <div>
        <p className="text-sm text-slate-400">Menu dealer</p>
        <h1 className="text-2xl font-bold">Buat Misi Duel</h1>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <Card className="space-y-5">
          <Stepper label="Jumlah menang" unit="duel" value={wins} min={1} max={50} onChange={setWins} />
          <Stepper label="Taruhan minimal" unit="poin" value={minStake} min={1} max={1000} onChange={setMinStake} />
          <Stepper label="Reward" unit="poin" value={reward} min={1} max={1000} onChange={setReward} />
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-300">Deadline</span>
            <input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              required
              className="h-12 w-full rounded-xl border border-white/10 bg-felt-950/60 px-4 text-base outline-none [color-scheme:dark] focus:border-gold-400/70 focus:ring-2 focus:ring-gold-400/20"
            />
          </label>
        </Card>

        <Card className="border-gold-400/40">
          <p className="text-xs uppercase tracking-wider text-slate-400">Pratinjau</p>
          <p className="mt-1 font-semibold">{missionText({ required_wins: wins, min_stake: minStake })}</p>
          <p className="mt-1 text-sm text-slate-400">
            Reward <span className="font-semibold text-gold-300">+{reward} poin</span>
            {validDeadline && ` · sampai ${formatDateTime(deadlineDate.toISOString())}`}
          </p>
          <ul className="mt-3 space-y-1.5 text-sm text-slate-300">
            <li>• Misi muncul di beranda semua player, lengkap dengan timer deadline.</li>
            <li>• Hanya duel yang selesai setelah misi dibuat dan sebelum deadline yang dihitung.</li>
            <li>• Reward masuk otomatis ke poin bulan ini dan total poin, sekali per player.</li>
          </ul>
        </Card>

        <ErrorText>{error}</ErrorText>

        <Button type="submit" loading={loading} disabled={!validDeadline} className="min-h-13 w-full text-base">
          🎯 Buat Misi
        </Button>
        <Button type="button" variant="ghost" onClick={() => navigate(-1)} className="w-full">
          Batal
        </Button>
      </form>
    </div>
  )
}

function Stepper({
  label,
  unit,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  unit: string
  value: number
  min: number
  max: number
  onChange: (n: number) => void
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n))
  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-slate-300">{label}</span>
      <div className="flex items-center justify-between rounded-xl bg-felt-950/60 p-2">
        <StepButton label="−" onClick={() => onChange(clamp(value - 1))} disabled={value <= min} />
        <div className="flex items-baseline justify-center">
          <input
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            value={value}
            onChange={(e) => onChange(clamp(Math.floor(Number(e.target.value) || min)))}
            aria-label={label}
            className="w-20 bg-transparent text-center text-3xl font-extrabold text-gold-400 outline-none"
          />
          <span className="text-sm text-slate-400">{unit}</span>
        </div>
        <StepButton label="+" onClick={() => onChange(clamp(value + 1))} disabled={value >= max} />
      </div>
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

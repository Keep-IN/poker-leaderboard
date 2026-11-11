import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useBounties, type Bounty } from '../lib/bounties'
import { formatDate } from '../lib/format'
import { bountyMessage, shareToWhatsApp } from '../lib/share'
import { errorMessage, supabase } from '../lib/supabase'
import ConfirmSheet from './ConfirmSheet'
import { Avatar, Button, Card, ErrorText, SectionTitle, cx } from './ui'

/** Bounty board on a player's Beranda: who is wanted and for how much. Hidden when there is nothing to show. */
export function PlayerBounties({ me }: { me: string }) {
  const { active, recent } = useBounties(`bounties-player-${me}`)
  if (!active || (active.length === 0 && recent.length === 0)) return null
  const mine = active.find((b) => b.target_id === me)

  return (
    <section>
      <SectionTitle>💰 Bounty</SectionTitle>
      {mine && (
        <Card className="mb-2 border-chip-red/50 bg-chip-red/10">
          <p className="font-semibold">Kamu jadi buruan! 🎯</p>
          <p className="mt-0.5 text-sm text-slate-300">
            Pemenang match yang kamu ikuti mengambil <span className="font-bold text-brand-400">+{mine.reward} poin</span>. Menang
            sendiri, dan bounty-nya jadi milikmu.
          </p>
        </Card>
      )}
      {active.length > 0 && (
        <div className="grid gap-2">
          {active.filter((b) => b.target_id !== me).map((b) => (
            <BountyCard key={b.id} bounty={b} />
          ))}
        </div>
      )}
      <ClaimedList recent={recent} />
    </section>
  )
}

/** Bounty manager on the dealer's Beranda: place a bounty on a player, cancel one, or share it to WhatsApp. */
export function DealerBounties() {
  const { active, recent, reload } = useBounties('bounties-dealer')
  const [players, setPlayers] = useState<{ player_id: string; name: string }[]>([])
  const [target, setTarget] = useState('')
  const [reward, setReward] = useState(10)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [cancelling, setCancelling] = useState<Bounty | null>(null)

  useEffect(() => {
    supabase.rpc('get_player_stats').then(({ data }) => setPlayers(((data as { player_id: string; name: string }[]) ?? []).sort((a, b) => a.name.localeCompare(b.name, 'id'))))
  }, [])

  const taken = new Set((active ?? []).map((b) => b.target_id))
  const choices = players.filter((p) => !taken.has(p.player_id))

  async function create(e: FormEvent) {
    e.preventDefault()
    if (!target) return setError('Pilih player yang mau dijadikan bounty.')
    setBusy(true)
    setError('')
    const { error } = await supabase.rpc('create_bounty', { p_target: target, p_reward: reward })
    setBusy(false)
    if (error) return setError(errorMessage(error))
    setTarget('')
    reload()
  }

  async function cancel(b: Bounty) {
    setBusy(true)
    setError('')
    const { error } = await supabase.rpc('cancel_bounty', { p_bounty: b.id })
    if (error) setError(errorMessage(error))
    await reload()
    setBusy(false)
    setCancelling(null)
  }

  return (
    <section>
      <SectionTitle>💰 Bounty</SectionTitle>
      <form onSubmit={create}>
        <Card className="space-y-3">
          <p className="text-sm text-slate-400">
            Pasang bounty ke player. Pemenang match yang diikuti player itu mendapat reward-nya; kalau si buruan sendiri yang
            menang, reward-nya untuk dia.
          </p>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              aria-label="Player yang dijadikan bounty"
              className="h-11 min-w-0 rounded-xl border border-ink/10 bg-surface-950/60 px-3 text-sm outline-none focus:border-brand-400/70"
            >
              <option value="">Pilih player…</option>
              {choices.map((p) => (
                <option key={p.player_id} value={p.player_id}>
                  {p.name}
                </option>
              ))}
            </select>
            <label className="flex h-11 items-center gap-2 rounded-xl border border-ink/10 bg-surface-950/60 px-3 text-sm">
              <span className="text-slate-400">Reward</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={1000}
                value={reward}
                onChange={(e) => setReward(Math.max(1, Math.min(1000, Math.floor(Number(e.target.value) || 1))))}
                className="w-16 bg-transparent text-right font-bold text-brand-400 outline-none"
              />
              <span className="text-slate-400">poin</span>
            </label>
            <Button type="submit" loading={busy && !cancelling}>
              💰 Pasang bounty
            </Button>
          </div>
        </Card>
      </form>
      <div className="mt-2">
        <ErrorText>{error}</ErrorText>
      </div>

      {active && active.length > 0 && (
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          {active.map((b) => (
            <BountyCard key={b.id} bounty={b}>
              <div className="mt-2 flex items-center justify-between gap-3 text-xs">
                <button onClick={() => shareToWhatsApp(bountyMessage(b))} className="font-semibold text-emerald-300 hover:text-emerald-200">
                  📲 Kirim ke grup WA
                </button>
                <button onClick={() => setCancelling(b)} className="text-slate-500 hover:text-slate-300">
                  Batalkan bounty
                </button>
              </div>
            </BountyCard>
          ))}
        </div>
      )}
      <ClaimedList recent={recent} />

      {cancelling && (
        <ConfirmSheet
          title="Batalkan bounty?"
          text={`Bounty ${cancelling.reward} poin untuk ${cancelling.target?.name ?? 'player'} akan dihapus dari daftar.`}
          action="Ya, batalkan"
          danger
          loading={busy}
          run={() => cancel(cancelling)}
          onCancel={() => setCancelling(null)}
          onConfirm={() => cancel(cancelling)}
        />
      )}
    </section>
  )
}

function BountyCard({ bounty: b, children }: { bounty: Bounty; children?: ReactNode }) {
  const name = b.target?.name ?? 'Player'
  return (
    <Card className="border-brand-400/30">
      <div className="flex items-center gap-3">
        <div className="relative">
          <Avatar name={name} id={b.target_id} />
          <span className="absolute -right-1 -bottom-1 text-sm">🎯</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{name}</p>
          <p className="text-xs text-slate-400">Menang di match yang dia ikuti</p>
        </div>
        <span className="shrink-0 rounded-lg bg-brand-400/15 px-2 py-1 text-sm font-bold text-brand-400">+{b.reward}</span>
      </div>
      {children}
    </Card>
  )
}

function ClaimedList({ recent }: { recent: Bounty[] }) {
  if (recent.length === 0) return null
  return (
    <Card className="mt-2 divide-y divide-ink/5 p-0">
      {recent.map((b) => {
        const self = b.claimed_by === b.target_id
        return (
          <div key={b.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
            <div className="min-w-0 flex-1">
              <p className="truncate text-slate-300">
                <span className="font-semibold">{b.claimer?.name ?? 'Player'}</span>{' '}
                {self ? 'menang & menyelamatkan bounty-nya sendiri' : <>mengklaim bounty <span className="font-semibold">{b.target?.name ?? 'player'}</span></>}
              </p>
              <p className="text-xs text-slate-500">{b.claimed_at && formatDate(b.claimed_at)}</p>
            </div>
            <span className={cx('shrink-0 text-xs font-bold', 'text-brand-400')}>+{b.reward}</span>
          </div>
        )
      })}
    </Card>
  )
}

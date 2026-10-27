import { useCallback, useEffect, useState } from 'react'
import { ACTIVE_DUEL_STATUSES, DUEL_SELECT, duelNames, type Duel } from '../lib/duels'
import { errorMessage, supabase } from '../lib/supabase'
import ConfirmSheet, { type Confirmation } from './ConfirmSheet'
import { Avatar, Button, Card, ErrorText, SectionTitle } from './ui'

/**
 * Player: their own unfinished duels. Dealer: duels awaiting approval plus the ones they host.
 * Reloads on any realtime change to the duels table.
 */
function useDuels(mode: 'player' | 'dealer', me: string) {
  const [duels, setDuels] = useState<Duel[]>([])

  const load = useCallback(async () => {
    const base = supabase.from('duels').select(DUEL_SELECT).order('created_at', { ascending: false })
    const { data } =
      mode === 'player'
        ? await base.in('status', ACTIVE_DUEL_STATUSES).or(`challenger_id.eq.${me},opponent_id.eq.${me}`)
        : await base.or(`status.eq.accepted,and(status.eq.approved,dealer_id.eq.${me})`)
    setDuels((data as unknown as Duel[]) ?? [])
  }, [mode, me])

  useEffect(() => {
    load()
    const sub = supabase
      .channel(`duels-${mode}-${me}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'duels' }, load)
      .subscribe()
    return () => {
      supabase.removeChannel(sub)
    }
  }, [mode, me, load])

  return { duels, reload: load }
}

/** Runs a duel RPC with shared busy/error/confirmation state. */
function useDuelActions(reload: () => Promise<void>) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState<Confirmation | null>(null)

  async function call(key: string, fn: string, args: Record<string, unknown>) {
    setBusy(key)
    setError('')
    const { error } = await supabase.rpc(fn, args)
    if (error) setError(errorMessage(error))
    await reload()
    setBusy(null)
  }

  const sheet = confirm && (
    <ConfirmSheet
      {...confirm}
      loading={busy === 'confirm'}
      onCancel={() => setConfirm(null)}
      onConfirm={async () => {
        await confirm.run()
        setConfirm(null)
      }}
    />
  )

  return { busy, error, call, ask: setConfirm, sheet }
}

export function PlayerDuelSections({ me }: { me: string }) {
  const { duels, reload } = useDuels('player', me)
  const { busy, error, call, ask, sheet } = useDuelActions(reload)

  const incoming = duels.filter((d) => d.status === 'pending' && d.opponent_id === me)
  const mine = duels.filter((d) => !(d.status === 'pending' && d.opponent_id === me))
  if (duels.length === 0) return null

  return (
    <>
      <ErrorText>{error}</ErrorText>

      {incoming.length > 0 && (
        <section>
          <SectionTitle>⚔️ Ajakan duel</SectionTitle>
          <div className="grid gap-2 md:grid-cols-2">
            {incoming.map((d) => {
              const { a } = duelNames(d)
              return (
                <Card key={d.id} className="border-gold-400/40">
                  <div className="flex items-center gap-3">
                    <Avatar name={a} id={d.challenger_id} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{a} mengajak kamu duel</p>
                      <p className="text-xs text-slate-400">Taruhan {d.stake} poin per pemain</p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button
                      variant="ghost"
                      loading={busy === `decline-${d.id}`}
                      onClick={() => call(`decline-${d.id}`, 'respond_duel', { p_duel: d.id, p_accept: false })}
                    >
                      Tolak
                    </Button>
                    <Button
                      onClick={() =>
                        ask({
                          title: `Terima duel dari ${a}?`,
                          text: `${d.stake} poin kamu langsung ditahan. Kalau menang +${d.stake}, kalau kalah −${d.stake}. Setelah diterima, duel menunggu persetujuan dealer. Taruhan diambil dari poin bulan ini dan total poin; kalau poin bulan ini kurang, sisanya dari total poin saja.`,
                          action: `⚔️ Terima (taruhan ${d.stake} poin)`,
                          run: () => call('confirm', 'respond_duel', { p_duel: d.id, p_accept: true }),
                        })
                      }
                    >
                      Terima
                    </Button>
                  </div>
                </Card>
              )
            })}
          </div>
        </section>
      )}

      {mine.length > 0 && (
        <section>
          <SectionTitle>Duel kamu</SectionTitle>
          <div className="grid gap-2 md:grid-cols-2">
            {mine.map((d) => {
              const { a, b } = duelNames(d)
              const canCancel = (d.status === 'pending' && d.challenger_id === me) || d.status === 'accepted'
              return (
                <Card key={d.id} className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">
                      {a} <span className="text-slate-500">vs</span> {b}
                    </p>
                    <p className="text-xs text-slate-400">
                      {d.stake} poin · <DuelStatusText duel={d} />
                    </p>
                  </div>
                  {canCancel && (
                    <Button
                      variant="ghost"
                      className="min-h-9 rounded-lg px-3 text-xs"
                      onClick={() =>
                        ask({
                          title: 'Batalkan duel?',
                          text: 'Semua taruhan yang sudah ditahan akan dikembalikan.',
                          action: 'Ya, batalkan',
                          danger: true,
                          run: () => call('confirm', 'cancel_duel', { p_duel: d.id }),
                        })
                      }
                    >
                      Batalkan
                    </Button>
                  )}
                </Card>
              )
            })}
          </div>
        </section>
      )}

      {sheet}
    </>
  )
}

export function DealerDuelSections({ me }: { me: string }) {
  const { duels, reload } = useDuels('dealer', me)
  const { busy, error, call, ask, sheet } = useDuelActions(reload)

  const waiting = duels.filter((d) => d.status === 'accepted')
  const hosting = duels.filter((d) => d.status === 'approved')
  if (duels.length === 0) return null

  return (
    <>
      <ErrorText>{error}</ErrorText>

      {waiting.length > 0 && (
        <section>
          <SectionTitle>⚔️ Duel menunggu persetujuan</SectionTitle>
          <div className="grid gap-2 md:grid-cols-2">
            {waiting.map((d) => {
              const { a, b } = duelNames(d)
              return (
                <Card key={d.id} className="border-gold-400/40">
                  <DuelVersus duel={d} />
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button
                      variant="ghost"
                      onClick={() =>
                        ask({
                          title: 'Tolak duel ini?',
                          text: `Taruhan ${a} dan ${b} akan dikembalikan.`,
                          action: 'Ya, tolak',
                          danger: true,
                          run: () => call('confirm', 'review_duel', { p_duel: d.id, p_approve: false }),
                        })
                      }
                    >
                      Tolak
                    </Button>
                    <Button
                      loading={busy === `approve-${d.id}`}
                      onClick={() => call(`approve-${d.id}`, 'review_duel', { p_duel: d.id, p_approve: true })}
                    >
                      Setujui & host
                    </Button>
                  </div>
                </Card>
              )
            })}
          </div>
        </section>
      )}

      {hosting.length > 0 && (
        <section>
          <SectionTitle>Duel yang kamu host</SectionTitle>
          <div className="grid gap-2 md:grid-cols-2">
            {hosting.map((d) => {
              const { a, b } = duelNames(d)
              const askWinner = (winnerId: string, winner: string, loser: string) =>
                ask({
                  title: `${winner} menang?`,
                  text: `${winner} mendapat +${d.stake} poin dari ${loser}. Aksi ini tidak bisa dibatalkan.`,
                  action: `🏆 Ya, ${winner} menang`,
                  run: () => call('confirm', 'finish_duel', { p_duel: d.id, p_winner: winnerId }),
                })
              return (
                <Card key={d.id} className="border-emerald-400/30">
                  <DuelVersus duel={d} />
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button className="min-h-10 truncate text-xs" onClick={() => askWinner(d.challenger_id, a, b)}>
                      🏆 {a.split(' ')[0]}
                    </Button>
                    <Button className="min-h-10 truncate text-xs" onClick={() => askWinner(d.opponent_id, b, a)}>
                      🏆 {b.split(' ')[0]}
                    </Button>
                  </div>
                  <button
                    className="mt-2 w-full text-center text-xs text-slate-500 hover:text-slate-300"
                    onClick={() =>
                      ask({
                        title: 'Batalkan duel?',
                        text: `Taruhan ${a} dan ${b} akan dikembalikan.`,
                        action: 'Ya, batalkan',
                        danger: true,
                        run: () => call('confirm', 'cancel_duel', { p_duel: d.id }),
                      })
                    }
                  >
                    Batalkan duel
                  </button>
                </Card>
              )
            })}
          </div>
        </section>
      )}

      {sheet}
    </>
  )
}

function DuelVersus({ duel }: { duel: Duel }) {
  const { a, b } = duelNames(duel)
  return (
    <div className="flex items-center gap-2">
      <Player name={a} id={duel.challenger_id} />
      <div className="shrink-0 text-center">
        <p className="text-lg">⚔️</p>
        <p className="text-[11px] font-semibold text-gold-300">{duel.stake} poin</p>
      </div>
      <Player name={b} id={duel.opponent_id} align="right" />
    </div>
  )
}

function Player({ name, id, align }: { name: string; id: string; align?: 'right' }) {
  return (
    <div className={align === 'right' ? 'flex min-w-0 flex-1 flex-row-reverse items-center gap-2' : 'flex min-w-0 flex-1 items-center gap-2'}>
      <Avatar name={name} id={id} size="sm" />
      <span className="truncate text-sm font-semibold">{name}</span>
    </div>
  )
}

function DuelStatusText({ duel }: { duel: Duel }) {
  if (duel.status === 'pending') return <span className="text-sky-300">Menunggu jawaban {duelNames(duel).b}</span>
  if (duel.status === 'accepted') return <span className="text-amber-300">Menunggu persetujuan dealer</span>
  return <span className="text-emerald-300">Berlangsung · Dealer {duel.dealer?.name ?? '-'}</span>
}

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Avatar, Button, Card, EmptyState, ErrorText, PageLoader, SectionTitle, cx } from '../components/ui'
import { useAuth } from '../lib/auth'
import { CARD_ICONS, type SkillCard } from '../lib/cards'
import { formatDateTime } from '../lib/format'
import { errorMessage, supabase } from '../lib/supabase'

interface GiftRow {
  id: string
  batch: string
  coins: number
  card_code: string | null
  card_qty: number
  message: string | null
  status: 'pending' | 'claimed' | 'cancelled'
  created_at: string
  player: { name: string } | null
}

/** Ringkasan isi gift: "100 koin + 2× Card Reroll". */
export function giftText(g: { coins: number; card_code: string | null; card_qty: number }, cardName?: string) {
  const parts = []
  if (g.coins > 0) parts.push(`🪙 ${g.coins} koin`)
  if (g.card_code && g.card_qty > 0) parts.push(`${CARD_ICONS[g.card_code] ?? '🃏'} ${g.card_qty}× ${cardName ?? g.card_code}`)
  return parts.join(' + ')
}

/** Menu dealer: kirim koin dan/atau skill card ke player, diklaim player di Beranda. */
export default function Gifts() {
  const { profile } = useAuth()
  const [players, setPlayers] = useState<{ id: string; name: string }[] | null>(null)
  const [cards, setCards] = useState<SkillCard[]>([])
  const [history, setHistory] = useState<GiftRow[]>([])
  const [all, setAll] = useState(true)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [coins, setCoins] = useState(50)
  const [card, setCard] = useState('')
  const [qty, setQty] = useState(1)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState('')
  const [loading, setLoading] = useState(false)

  const loadHistory = useCallback(async () => {
    const { data } = await supabase
      .from('gifts')
      .select('id, batch, coins, card_code, card_qty, message, status, created_at, player:profiles!gifts_player_id_fkey(name)')
      .order('created_at', { ascending: false })
      .limit(300)
    setHistory((data as unknown as GiftRow[]) ?? [])
  }, [])

  useEffect(() => {
    supabase.from('profiles').select('id, name').eq('role', 'player').order('name').then(({ data }) => setPlayers(data ?? []))
    supabase.from('skill_cards').select('*').order('sort').then(({ data }) => setCards((data as SkillCard[]) ?? []))
    loadHistory()
  }, [loadHistory])

  const cardName = useMemo(() => new Map(cards.map((c) => [c.code, c.name])), [cards])
  // kiriman yang sama (satu batch) digabung jadi satu baris
  const batches = useMemo(() => {
    const m = new Map<string, GiftRow[]>()
    history.forEach((g) => m.set(g.batch, [...(m.get(g.batch) ?? []), g]))
    return [...m.values()].slice(0, 20)
  }, [history])

  if (!profile || !players) return <PageLoader />
  if (profile.role !== 'dealer')
    return (
      <Card className="md:mx-auto md:max-w-xl">
        <EmptyState icon="🎁" title="Khusus dealer" text="Hanya dealer yang bisa mengirim gift." />
        <Link to="/" className="block text-center text-sm font-semibold text-brand-400">
          Kembali ke beranda
        </Link>
      </Card>
    )

  const count = all ? players.length : picked.size
  const useCard = card !== ''
  const valid = count > 0 && (coins > 0 || useCard)
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!valid) return
    setError('')
    setDone('')
    setLoading(true)
    const { data, error } = await supabase.rpc('send_gift', {
      p_players: all ? null : [...picked],
      p_coins: coins,
      p_card: useCard ? card : null,
      p_qty: useCard ? qty : 0,
      p_message: message.trim() || null,
    })
    setLoading(false)
    if (error) return setError(errorMessage(error))
    setDone(`🎁 Gift terkirim ke ${data} player. Mereka tinggal klaim di Beranda.`)
    setMessage('')
    loadHistory()
  }

  async function cancel(g: GiftRow) {
    const { error } = await supabase.rpc('cancel_gift', { p_gift: g.id, p_batch: true })
    if (error) return setError(errorMessage(error))
    loadHistory()
  }

  const preview = giftText({ coins, card_code: useCard ? card : null, card_qty: qty }, cardName.get(card))

  return (
    <div className="space-y-4 md:mx-auto md:max-w-xl">
      <div>
        <p className="text-sm text-slate-400">Menu dealer</p>
        <h1 className="text-2xl font-bold">Kirim Gift</h1>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <Card className="space-y-3">
          <span className="block text-sm font-medium text-slate-300">Penerima</span>
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-950/60 p-1">
            {[true, false].map((v) => (
              <button
                key={String(v)}
                type="button"
                onClick={() => setAll(v)}
                className={cx('min-h-10 rounded-lg text-sm font-semibold transition', all === v ? 'bg-brand-400 text-on-accent' : 'text-slate-400 hover:text-slate-200')}
              >
                {v ? `👥 Semua player (${players.length})` : '☝️ Pilih player'}
              </button>
            ))}
          </div>
          {!all && (
            <div className="flex flex-wrap gap-2">
              {players.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggle(p.id)}
                  aria-pressed={picked.has(p.id)}
                  className={cx(
                    'flex min-h-10 items-center gap-2 rounded-xl border py-1 pr-3 pl-1 text-sm transition',
                    picked.has(p.id) ? 'border-brand-400 bg-brand-400/15 text-brand-200' : 'border-ink/10 text-slate-300 hover:bg-ink/5',
                  )}
                >
                  <Avatar name={p.name} id={p.id} size="sm" />
                  {p.name}
                  {picked.has(p.id) && <span>✓</span>}
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-300">Koin (0 kalau cuma kartu)</span>
            <div className="flex items-center gap-2">
              {[0, 50, 100, 250, 500].map((v) => (
                <button key={v} type="button" onClick={() => setCoins(v)}
                  className={cx('min-h-10 flex-1 rounded-lg text-sm font-semibold transition', coins === v ? 'bg-amber-400 text-[#04122b]' : 'bg-ink/5 text-slate-300 hover:bg-ink/10')}>
                  {v}
                </button>
              ))}
            </div>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={10000}
              value={coins}
              onChange={(e) => setCoins(Math.min(10000, Math.max(0, Math.floor(Number(e.target.value) || 0))))}
              className="mt-2 h-12 w-full rounded-xl border border-ink/10 bg-surface-950/60 px-4 text-lg font-bold text-amber-300 outline-none focus:border-brand-400/70"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-300">Skill card (opsional)</span>
            <select
              value={card}
              onChange={(e) => setCard(e.target.value)}
              className="h-12 w-full rounded-xl border border-ink/10 bg-surface-950/60 px-3 text-base outline-none [color-scheme:dark] focus:border-brand-400/70"
            >
              <option value="">Tanpa kartu</option>
              {cards.map((c) => (
                <option key={c.code} value={c.code}>
                  {CARD_ICONS[c.code] ?? '🃏'} {c.name}{c.kind === 'wildcard' ? ' ☠' : c.kind === 'angelic' ? ' ✦' : ''}
                </option>
              ))}
            </select>
          </label>
          {useCard && (
            <div>
              <span className="mb-1.5 block text-sm font-medium text-slate-300">Jumlah kartu per player</span>
              <div className="flex gap-1">
                {[1, 2, 3, 5, 10].map((v) => (
                  <button key={v} type="button" onClick={() => setQty(v)}
                    className={cx('min-h-10 flex-1 rounded-lg text-sm font-semibold transition', qty === v ? 'bg-brand-400 text-on-accent' : 'bg-ink/5 text-slate-300 hover:bg-ink/10')}>
                    {v}×
                  </button>
                ))}
              </div>
            </div>
          )}

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-300">Pesan (opsional)</span>
            <input
              value={message}
              maxLength={140}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="mis. Hadiah turnamen akhir bulan 🎉"
              className="h-12 w-full rounded-xl border border-ink/10 bg-surface-950/60 px-4 text-base outline-none focus:border-brand-400/70"
            />
          </label>
        </Card>

        <Card className="border-brand-400/40">
          <p className="text-xs uppercase tracking-wider text-slate-400">Pratinjau</p>
          <p className="mt-1 font-semibold">{preview || 'Isi koin atau pilih skill card'}</p>
          <p className="mt-1 text-sm text-slate-400">
            untuk {all ? 'semua player' : `${count} player`} · kartu gift tidak mengurangi stok market
          </p>
        </Card>

        <ErrorText>{error}</ErrorText>
        {done && <p className="rounded-xl bg-emerald-500/15 px-4 py-3 text-sm text-emerald-300">{done}</p>}

        <Button type="submit" loading={loading} disabled={!valid} className="min-h-13 w-full text-base">
          🎁 Kirim Gift
        </Button>
      </form>

      <section>
        <SectionTitle>Riwayat gift</SectionTitle>
        {batches.length === 0 ? (
          <Card>
            <EmptyState icon="🎁" title="Belum ada gift" />
          </Card>
        ) : (
          <Card className="divide-y divide-ink/5 p-0">
            {batches.map((b) => {
              const g = b[0], claimed = b.filter((x) => x.status === 'claimed').length, pending = b.filter((x) => x.status === 'pending').length
              const names = b.map((x) => x.player?.name ?? '?')
              return (
                <div key={g.batch} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{giftText(g, g.card_code ? cardName.get(g.card_code) : undefined)}</p>
                    <p className="truncate text-xs text-slate-400">
                      {formatDateTime(g.created_at)} · {b.length > 3 ? `${b.length} player` : names.join(', ')} · {claimed}/{b.length} diklaim
                      {b.length - claimed - pending > 0 ? ` · ${b.length - claimed - pending} dibatalkan` : ''}
                    </p>
                    {g.message && <p className="truncate text-xs italic text-slate-500">“{g.message}”</p>}
                  </div>
                  {pending > 0 && (
                    <Button variant="danger" className="min-h-9 shrink-0 px-3 text-xs" onClick={() => cancel(g)}>
                      Batalkan {pending}
                    </Button>
                  )}
                </div>
              )
            })}
          </Card>
        )}
      </section>
    </div>
  )
}

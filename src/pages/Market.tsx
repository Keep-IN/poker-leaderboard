import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import ConfirmSheet from '../components/ConfirmSheet'
import { Button, Card, EmptyState, ErrorText, PageLoader, cx } from '../components/ui'
import { useAuth } from '../lib/auth'
import { CARD_ICONS, KIND_LABELS, type SkillCard } from '../lib/cards'
import { useCoins } from '../lib/coins'
import { errorMessage, supabase } from '../lib/supabase'

function useCatalog() {
  const [cards, setCards] = useState<SkillCard[] | null>(null)
  const load = useCallback(async () => {
    const { data } = await supabase.from('skill_cards').select('*').order('sort')
    setCards((data as SkillCard[]) ?? [])
  }, [])
  useEffect(() => {
    load()
    const sub = supabase
      .channel('market')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'skill_cards' }, load)
      .subscribe()
    return () => {
      supabase.removeChannel(sub)
    }
  }, [load])
  return { cards, reload: load }
}

export default function Market() {
  const { profile } = useAuth()
  const isDealer = profile?.role === 'dealer'
  const { cards, reload } = useCatalog()
  const { balance, reload: reloadCoins } = useCoins(!isDealer)
  const [buying, setBuying] = useState<SkillCard | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')

  if (!profile || !cards) return <PageLoader />

  async function buy(c: SkillCard) {
    setBusy(true)
    setError('')
    setDone('')
    const { error } = await supabase.rpc('buy_card', { p_code: c.code })
    setBusy(false)
    setBuying(null)
    if (error) return setError(errorMessage(error))
    setDone(`${c.name} masuk ke inventory kamu.`)
    reload()
    reloadCoins()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Market</h1>
          <p className="text-sm text-slate-400">{isDealer ? 'Atur skill card yang dijual, harga, dan stoknya.' : 'Beli skill card pakai koin.'}</p>
        </div>
        {!isDealer && (
          <div className="flex items-center gap-2">
            <span className="rounded-xl bg-amber-500/15 px-3 py-2 text-sm font-bold text-amber-300">🪙 {balance ?? '…'} koin</span>
            <Link to="/inventory" className="rounded-xl border border-ink/10 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-ink/5">
              🎒 Inventory
            </Link>
          </div>
        )}
      </div>

      <ErrorText>{error}</ErrorText>
      {done && <p className="rounded-xl bg-emerald-500/15 px-3 py-2 text-sm text-emerald-300">✓ {done}</p>}

      {isDealer ? (
        <div className="grid gap-3 md:grid-cols-2">
          {cards.map((c) => (
            <DealerListing key={c.code} card={c} onSaved={reload} />
          ))}
        </div>
      ) : cards.filter((c) => c.on_sale).length === 0 ? (
        <Card>
          <EmptyState icon="🛒" title="Market masih kosong" text="Belum ada skill card yang dijual. Tunggu dealer membuka market." />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {cards
            .filter((c) => c.on_sale)
            .map((c) => {
              const short = balance !== null && balance < c.price
              return (
                <CardTile key={c.code} card={c}>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="text-xs text-slate-400">{c.stock > 0 ? `Stok ${c.stock}` : 'Stok habis'}</span>
                    <Button className="min-h-10 px-4" disabled={c.stock < 1 || short} onClick={() => setBuying(c)}>
                      {c.stock < 1 ? 'Habis' : short ? `Butuh ${c.price} 🪙` : `Beli · ${c.price} 🪙`}
                    </Button>
                  </div>
                </CardTile>
              )
            })}
        </div>
      )}

      <p className="text-center text-xs text-slate-500">
        Koin didapat dari ikut match (+10, juara +15, runner-up +8/+4), gaji bulanan dari leaderboard, dan pencapaian. Koin tidak
        mengurangi poin leaderboard.
      </p>

      {buying && (
        <ConfirmSheet
          title={`Beli ${buying.name}?`}
          text={`${buying.price} koin akan dipakai. Saldo kamu sekarang ${balance} koin, sisa ${(balance ?? 0) - buying.price} koin.`}
          action={`Beli · ${buying.price} 🪙`}
          loading={busy}
          run={() => buy(buying)}
          onCancel={() => setBuying(null)}
          onConfirm={() => buy(buying)}
        />
      )}
    </div>
  )
}

export function CardTile({ card: c, children, dim }: { card: Pick<SkillCard, 'code' | 'name' | 'kind' | 'description'>; children?: React.ReactNode; dim?: boolean }) {
  const kind = KIND_LABELS[c.kind]
  return (
    <Card className={cx('relative overflow-hidden', dim && 'opacity-60')}>
      <div className="pointer-events-none absolute -top-4 -right-2 text-[90px] leading-none opacity-[0.07]">{CARD_ICONS[c.code] ?? '🃏'}</div>
      <div className="flex items-start gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand-400/15 text-2xl">{CARD_ICONS[c.code] ?? '🃏'}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-bold">{c.name}</p>
            <span className={cx('rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider', kind.tone)}>
              {kind.icon} {kind.label}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-400">{c.description}</p>
        </div>
      </div>
      {children}
    </Card>
  )
}

function DealerListing({ card, onSaved }: { card: SkillCard; onSaved: () => void }) {
  const [price, setPrice] = useState(card.price)
  const [stock, setStock] = useState(card.stock)
  const [onSale, setOnSale] = useState(card.on_sale)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const changed = price !== card.price || stock !== card.stock || onSale !== card.on_sale

  async function save() {
    setBusy(true)
    setMsg('')
    const { error } = await supabase.rpc('set_card_listing', { p_code: card.code, p_price: price, p_stock: stock, p_on_sale: onSale })
    setBusy(false)
    setMsg(error ? errorMessage(error) : 'Tersimpan')
    if (!error) onSaved()
  }

  const field = 'h-10 w-full rounded-xl border border-ink/10 bg-surface-950/60 px-3 text-sm font-bold outline-none focus:border-brand-400/70'
  return (
    <CardTile card={card}>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="text-xs text-slate-400">
          Harga (koin)
          <input type="number" min={1} max={10000} value={price} onChange={(e) => setPrice(Math.max(1, Math.floor(Number(e.target.value) || 1)))} className={field} />
        </label>
        <label className="text-xs text-slate-400">
          Stok
          <input type="number" min={0} max={1000} value={stock} onChange={(e) => setStock(Math.max(0, Math.floor(Number(e.target.value) || 0)))} className={field} />
        </label>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={onSale} onChange={(e) => setOnSale(e.target.checked)} className="size-4 accent-[var(--color-brand-400)]" />
          Dijual di market
        </label>
        <Button className="min-h-9 px-4 text-xs" disabled={!changed} loading={busy} onClick={save}>
          Simpan
        </Button>
      </div>
      {msg && <p className="mt-1 text-right text-xs text-slate-400">{msg}</p>}
    </CardTile>
  )
}

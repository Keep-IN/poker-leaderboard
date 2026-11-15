import { useCallback, useEffect, useRef, useState } from 'react'
import { CARD_ICONS, type SkillCard } from '../lib/cards'
import { errorMessage, supabase } from '../lib/supabase'
import { Button, Card, ErrorText, SectionTitle, cx } from './ui'

export type Rarity = 'zonk' | 'common' | 'rare' | 'epic' | 'legendary'
type CardRarity = Exclude<Rarity, 'zonk'>

/** Peluang dasar (sama dengan public.gacha_pull). */
export const RARITY: Record<Rarity, { label: string; pct: string; tone: string }> = {
  legendary: { label: 'Legendary', pct: '0.5%', tone: 'text-amber-300' },
  epic: { label: 'Epic', pct: '3.5%', tone: 'text-violet-300' },
  rare: { label: 'Rare', pct: '13%', tone: 'text-sky-300' },
  common: { label: 'Common', pct: '58%', tone: 'text-slate-200' },
  zonk: { label: 'Zonk', pct: '25%', tone: 'text-slate-400' },
}
const RANK: Rarity[] = ['zonk', 'common', 'rare', 'epic', 'legendary']
const PITY_EPIC = 25, PITY_LEGEND = 150, ZONK_REFUND = 10

interface Config { enabled: boolean; price: number; price10: number }
interface Pity { epic: number; legend: number; pulls: number }
interface Pull { id: string; slot: number; rarity: Rarity; card_code: string | null; refund: number; created_at: string }

function useGacha() {
  const [config, setConfig] = useState<Config | null>(null)
  const [pity, setPity] = useState<Pity>({ epic: 0, legend: 0, pulls: 0 })
  const [history, setHistory] = useState<Pull[]>([])
  const load = useCallback(async () => {
    const [c, p, h] = await Promise.all([
      supabase.from('gacha_config').select('enabled, price, price10').eq('id', 1).maybeSingle(),
      supabase.from('gacha_pity').select('epic, legend, pulls').maybeSingle(),
      supabase.from('gacha_pulls').select('id, slot, rarity, card_code, refund, created_at').order('created_at', { ascending: false }).limit(20),
    ])
    setConfig((c.data as Config) ?? { enabled: false, price: 50, price10: 450 })
    if (p.data) setPity(p.data as Pity)
    setHistory((h.data as Pull[]) ?? [])
  }, [])
  useEffect(() => {
    load()
  }, [load])
  return { config, pity, history, reload: load }
}

/** Tab Gacha untuk player: peluang, pity, tombol 1x/10x, animasi, dan riwayat tarikan. */
export function GachaPanel({ cards, balance, onCoins }: { cards: SkillCard[]; balance: number | null; onCoins: () => void }) {
  const { config, pity, history, reload } = useGacha()
  const [busy, setBusy] = useState(0)
  const [error, setError] = useState('')
  const [result, setResult] = useState<Pull[] | null>(null)
  const byCode = new Map(cards.map((c) => [c.code, c]))
  const pool = (r: CardRarity) => cards.filter((c) => c.in_gacha && c.rarity === r)

  async function pull(n: 1 | 10) {
    setBusy(n)
    setError('')
    const { data, error } = await supabase.rpc('gacha_pull', { p_count: n })
    setBusy(0)
    if (error) return setError(errorMessage(error))
    setResult(((data as Pull[]) ?? []).sort((a, b) => a.slot - b.slot))
    onCoins()
    reload()
  }

  if (!config) return null
  const cost = (n: 1 | 10) => (n === 1 ? config.price : config.price10)
  const short = (n: 1 | 10) => balance !== null && balance < cost(n)

  return (
    <div className="space-y-4">
      <Card className="gacha-banner relative overflow-hidden">
        <div className="pointer-events-none absolute -top-8 -right-6 text-[140px] leading-none opacity-10">🎰</div>
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-300">Skill Card Gacha</p>
        <h2 className="mt-1 text-2xl font-extrabold">Tarik kartu, uji keberuntungan!</h2>
        <p className="mt-1 text-sm text-slate-300">
          Semua skill card bisa keluar, termasuk wildcard & angelic yang belum dijual di Market. Zonk = {ZONK_REFUND} koin kembali.
        </p>
        {!config.enabled ? (
          <p className="mt-4 rounded-xl bg-ink/5 px-3 py-2 text-sm text-slate-300">Gacha sedang ditutup dealer.</p>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button className="min-h-14 flex-col gap-0" loading={busy === 1} disabled={!!busy || short(1)} onClick={() => pull(1)}>
              <span className="text-base font-extrabold">Tarik 1×</span>
              <span className="text-xs opacity-80">{config.price} 🪙</span>
            </Button>
            <Button className="gacha-ten min-h-14 flex-col gap-0" loading={busy === 10} disabled={!!busy || short(10)} onClick={() => pull(10)}>
              <span className="text-base font-extrabold">Tarik 10×</span>
              <span className="text-xs opacity-80">{config.price10} 🪙 · min. 1 Rare</span>
            </Button>
          </div>
        )}
        <ErrorText>{error}</ErrorText>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        <Card className="space-y-2">
          <SectionTitle>Peluang</SectionTitle>
          {RANK.slice().reverse().map((r) => (
            <div key={r} className="flex items-center justify-between gap-3 text-sm">
              <span className={cx('font-bold', RARITY[r].tone)}>
                <span className={cx('gacha-dot', `g-${r}`)} /> {RARITY[r].label}
              </span>
              <span className="text-slate-400">
                {r !== 'zonk' && `${pool(r).length} kartu · `}
                <b className="text-slate-200">{RARITY[r].pct}</b>
              </span>
            </div>
          ))}
          <p className="pt-1 text-xs text-slate-500">Tiap kartu dalam satu rarity punya peluang sama. Gacha tidak memakai stok Market.</p>
        </Card>
        <Card className="space-y-3">
          <SectionTitle>Pity kamu</SectionTitle>
          <PityBar label="Epic dijamin" now={pity.epic} max={PITY_EPIC} tone="bg-violet-400" />
          <PityBar label="Legendary dijamin" now={pity.legend} max={PITY_LEGEND} tone="bg-amber-400" />
          <p className="text-xs text-slate-500">Total {pity.pulls} tarikan. Penghitung kembali ke 0 saat rarity itu keluar.</p>
        </Card>
      </div>

      {history.length > 0 && (
        <Card className="space-y-2">
          <SectionTitle>Riwayat tarikan</SectionTitle>
          <div className="flex flex-wrap gap-1.5">
            {history.map((h) => (
              <span key={h.id} className={cx('gacha-chip', `g-${h.rarity}`)} title={new Date(h.created_at).toLocaleString('id-ID')}>
                {h.card_code ? `${CARD_ICONS[h.card_code] ?? '🃏'} ${byCode.get(h.card_code)?.name ?? h.card_code}` : `💨 Zonk +${h.refund}`}
              </span>
            ))}
          </div>
        </Card>
      )}

      {result && (
        <GachaReveal
          pulls={result}
          byCode={byCode}
          onClose={() => setResult(null)}
          again={config.enabled ? (n) => { setResult(null); pull(n) } : undefined}
          canAgain={(n) => !short(n)}
        />
      )}
    </div>
  )
}

function PityBar({ label, now, max, tone }: { label: string; now: number; max: number; tone: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-400">
        <span>{label}</span>
        <span>
          {now}/{max}
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink/10">
        <div className={cx('h-full rounded-full transition-all', tone)} style={{ width: `${Math.min(100, (now / max) * 100)}%` }} />
      </div>
    </div>
  )
}

/**
 * Animasi gacha: orb mengisi energi (warnanya bocoran rarity tertinggi), lalu kartu dibuka.
 * 1x: satu kartu bergetar lalu dibalik. 10x: sepuluh kartu meluncur masuk, dibuka berurutan; Epic/Legendary diberi
 * jeda dan sorotan. Ketuk orb untuk lewati, tombol Lewati membuka semua kartu.
 */
function GachaReveal({ pulls, byCode, onClose, again, canAgain }: {
  pulls: Pull[]
  byCode: Map<string, SkillCard>
  onClose: () => void
  again?: (n: 1 | 10) => void
  canAgain: (n: 1 | 10) => boolean
}) {
  const top = pulls.reduce<Rarity>((m, p) => (RANK.indexOf(p.rarity) > RANK.indexOf(m) ? p.rarity : m), 'zonk')
  const multi = pulls.length > 1
  const [phase, setPhase] = useState<'summon' | 'reveal'>('summon')
  const [open, setOpen] = useState(0) // jumlah kartu yang sudah dibuka
  const [spot, setSpot] = useState(-1)
  const timers = useRef<number[]>([])
  const later = (ms: number, f: () => void) => { timers.current.push(window.setTimeout(f, ms)) }
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  // tahap 1: orb mengisi energi
  useEffect(() => {
    if (phase !== 'summon') return
    const t = window.setTimeout(() => setPhase('reveal'), top === 'legendary' ? 2600 : top === 'epic' ? 2200 : 1800)
    return () => clearTimeout(t)
  }, [phase, top])

  // tahap 2: buka kartu satu per satu
  useEffect(() => {
    if (phase !== 'reveal') return
    if (!multi) { later(700, () => setOpen(1)); return }
    let t = 900 // tunggu kartu meluncur masuk
    pulls.forEach((p, i) => {
      const big = p.rarity === 'epic' || p.rarity === 'legendary'
      if (big) { later(t, () => setSpot(i)); t += 650 }
      later(t, () => setOpen(i + 1))
      t += big ? 900 : 260
      if (big) later(t, () => setSpot(-1))
    })
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  const done = phase === 'reveal' && open >= pulls.length
  const skip = () => { timers.current.forEach(clearTimeout); timers.current = []; setPhase('reveal'); setSpot(-1); setOpen(pulls.length) }

  return (
    <div className={cx('gacha-overlay', `g-${top}`)} role="dialog" aria-label="Hasil gacha">
      {phase === 'summon' ? (
        <button type="button" className="gacha-summon" onClick={skip} aria-label="Lewati animasi">
          {top === 'legendary' && <span className="gacha-rays" />}
          <span className="gacha-orb" />
          <span className="gacha-ring" />
          <span className="gacha-ring r2" />
          <span className="gacha-hint">Ketuk untuk lewati</span>
        </button>
      ) : (
        <div className="gacha-stage">
          <div className={cx('gacha-grid', multi ? 'ten' : 'one')}>
            {pulls.map((p, i) => (
              <GachaCard key={p.id} pull={p} card={p.card_code ? byCode.get(p.card_code) : undefined} open={i < open} spot={spot === i} delay={multi ? i * 70 : 0} big={!multi} />
            ))}
          </div>
          {done ? (
            <div className="gacha-actions">
              <p className="gacha-sum">
                {RANK.slice(1).reverse().map((r) => {
                  const n = pulls.filter((p) => p.rarity === r).length
                  return n ? <span key={r} className={cx('gacha-chip', `g-${r}`)}>{RARITY[r].label} ×{n}</span> : null
                })}
                {pulls.some((p) => p.rarity === 'zonk') && <span className="gacha-chip g-zonk">Zonk ×{pulls.filter((p) => p.rarity === 'zonk').length}</span>}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {again && (
                  <Button className="min-w-32" disabled={!canAgain(multi ? 10 : 1)} onClick={() => again(multi ? 10 : 1)}>
                    Tarik lagi {multi ? '10×' : '1×'}
                  </Button>
                )}
                <Button variant="ghost" className="min-w-32" onClick={onClose}>
                  Tutup
                </Button>
              </div>
              <p className="text-xs text-slate-400">Kartu sudah masuk ke 🎒 Inventory.</p>
            </div>
          ) : (
            multi && (
              <button type="button" className="gacha-skip" onClick={skip}>
                Lewati ⏭
              </button>
            )
          )}
        </div>
      )}
    </div>
  )
}

function GachaCard({ pull: p, card, open, spot, delay, big }: { pull: Pull; card?: SkillCard; open: boolean; spot: boolean; delay: number; big: boolean }) {
  return (
    <div className={cx('gcard', `g-${p.rarity}`, open && 'flipped', spot && 'spot', big && 'big')} style={{ '--d': `${delay}ms` } as React.CSSProperties}>
      <div className="gcard-inner">
        <div className="gcard-face back">
          <span>🂠</span>
        </div>
        <div className="gcard-face front">
          {open && (p.rarity === 'legendary' || p.rarity === 'epic') && <span className="gcard-burst" />}
          <span className="gcard-icon">{p.card_code ? CARD_ICONS[p.card_code] ?? '🃏' : '💨'}</span>
          <span className="gcard-name">{p.card_code ? card?.name ?? p.card_code : `Zonk +${p.refund}🪙`}</span>
          <span className="gcard-rar">{RARITY[p.rarity].label}</span>
        </div>
      </div>
    </div>
  )
}

/** Pengaturan gacha untuk dealer: buka/tutup, harga, rarity & pool tiap kartu. */
export function GachaDealer({ cards, onSaved }: { cards: SkillCard[]; onSaved: () => void }) {
  const { config, reload } = useGacha()
  const [form, setForm] = useState<Config | null>(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState('')
  useEffect(() => {
    if (config) setForm(config)
  }, [config])
  if (!form) return null

  async function saveConfig() {
    setBusy('cfg')
    const { error } = await supabase.rpc('set_gacha', { p_enabled: form!.enabled, p_price: form!.price, p_price10: form!.price10 })
    setBusy('')
    setMsg(error ? errorMessage(error) : 'Pengaturan gacha tersimpan')
    reload()
  }
  async function saveCard(c: SkillCard, rarity: string, inGacha: boolean) {
    setBusy(c.code)
    const { error } = await supabase.rpc('set_card_gacha', { p_code: c.code, p_rarity: rarity, p_in_gacha: inGacha })
    setBusy('')
    setMsg(error ? errorMessage(error) : `${c.name} tersimpan`)
    onSaved()
  }
  const field = 'h-10 w-full rounded-xl border border-ink/10 bg-surface-950/60 px-3 text-sm font-bold outline-none focus:border-brand-400/70'

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <SectionTitle>🎰 Pengaturan gacha</SectionTitle>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} className="size-4 accent-[var(--color-brand-400)]" />
          Gacha dibuka untuk player
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-slate-400">
            Harga 1× (koin)
            <input type="number" min={1} value={form.price} onChange={(e) => setForm({ ...form, price: Math.max(1, Math.floor(Number(e.target.value) || 1)) })} className={field} />
          </label>
          <label className="text-xs text-slate-400">
            Harga 10× (koin)
            <input type="number" min={1} value={form.price10} onChange={(e) => setForm({ ...form, price10: Math.max(1, Math.floor(Number(e.target.value) || 1)) })} className={field} />
          </label>
        </div>
        <p className="text-xs text-slate-500">
          Peluang: Legendary 0.5% · Epic 3.5% · Rare 13% · Common 58% · Zonk 25% (10 koin kembali). Pity Epic 25, Legendary 150. 10× dijamin minimal 1 Rare.
        </p>
        <Button className="min-h-10" loading={busy === 'cfg'} onClick={saveConfig}>
          Simpan pengaturan
        </Button>
        {msg && <p className="text-xs text-slate-400">{msg}</p>}
      </Card>
      <Card className="divide-y divide-ink/5 p-0">
        {cards.map((c) => (
          <div key={c.code} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
            <span className="text-xl">{CARD_ICONS[c.code] ?? '🃏'}</span>
            <span className="min-w-0 flex-1 text-sm font-semibold">{c.name}</span>
            <select
              value={c.rarity ?? 'common'}
              disabled={busy === c.code}
              onChange={(e) => saveCard(c, e.target.value, c.in_gacha)}
              className="h-9 rounded-lg border border-ink/10 bg-surface-950/60 px-2 text-xs font-bold"
            >
              {(['common', 'rare', 'epic', 'legendary'] as const).map((r) => (
                <option key={r} value={r}>
                  {RARITY[r].label}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-xs text-slate-400">
              <input type="checkbox" checked={c.in_gacha} disabled={busy === c.code} onChange={(e) => saveCard(c, c.rarity ?? 'common', e.target.checked)} className="size-4 accent-[var(--color-brand-400)]" />
              Pool
            </label>
          </div>
        ))}
      </Card>
    </div>
  )
}

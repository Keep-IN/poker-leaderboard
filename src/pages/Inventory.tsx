import { Link } from 'react-router-dom'
import { Card, EmptyState, PageLoader, SectionTitle } from '../components/ui'
import { kindRank, useMyCards, type OwnedCard } from '../lib/cards'
import { formatDate } from '../lib/format'
import { CardTile } from './Market'

const howToUse: Record<string, string> = {
  double_down: 'Pasang di halaman match online yang sudah kamu join, sebelum match dimulai. Memakai 1 dari 3 jatah kartu match itu.',
  full_counter: 'Pasang di halaman match online yang sudah kamu join, sebelum match dimulai. Aktif sepanjang match; memakai 1 dari 3 jatah kartu.',
  pair_me_up: 'Pakai di meja online lewat 🎒: hand berikutnya kamu pasti dapat pocket pair.',
  defend_me: 'Pakai di meja poker online lewat tombol 🎒 saat hand berjalan.',
  reveal_card: 'Pakai di meja online lewat tombol 🎒, lalu pilih lawan yang mau diintip.',
  fold_player: 'Pakai di meja online lewat tombol 🎒 sebelum flop, lalu pilih lawan.',
  you_owe_me: 'Pakai di meja online lewat 🎒 (pemain minimal 3), pilih korban. Jalan setelah hand selesai.',
  duel_me: 'Pakai di meja online lewat 🎒 saat hand berjalan, sebelum turn (pemain minimal 3). Pilih lawan duel, yang lain dipaksa fold; lawanmu fold = denda 50% chip.',
  get_out: 'Pakai di meja online lewat 🎒 (pemain minimal 3), pilih korban. Jalan setelah hand selesai.',
  go_big: 'Pakai di meja online lewat 🎒 saat hand berjalan (pemain minimal 3). Lawan yang fold kena denda 50% chip.',
  revive: 'Pakai di meja online lewat 🎒 (pemain tersisa minimal 3), pilih pemain yang tersingkir, termasuk dirimu sendiri.',
  card_reroll: 'Pakai di meja online lewat 🎒 saat hand berjalan: 2 kartu tanganmu ditukar dengan kartu baru.',
}

export default function Inventory() {
  const { cards } = useMyCards()
  if (!cards) return <PageLoader />

  const owned = cards.filter((c) => c.status === 'owned')
  const armed = cards.filter((c) => c.status === 'armed')
  const used = cards.filter((c) => c.status === 'used')
  // kartu yang sama digabung: tampil satu kali dengan jumlahnya
  const groups = [...owned.reduce((m, c) => m.set(c.card_code, [...(m.get(c.card_code) ?? []), c]), new Map<string, OwnedCard[]>()).values()]
    .sort((x, y) => kindRank(x[0].card?.kind) - kindRank(y[0].card?.kind)) // kartu cursed paling atas, lalu angelic

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">🎒 Inventory</h1>
          <p className="text-sm text-slate-400">Skill card yang kamu punya.</p>
        </div>
        <Link to="/market" className="rounded-xl border border-ink/10 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-ink/5">
          🛒 Ke Market
        </Link>
      </div>

      {groups.length === 0 && armed.length === 0 ? (
        <Card>
          <EmptyState icon="🎒" title="Inventory masih kosong" text="Beli skill card di Market pakai koin." />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {groups.map((g) => (
            <CardTile key={g[0].card_code} card={{ code: g[0].card_code, name: g[0].card?.name ?? g[0].card_code, kind: g[0].card?.kind ?? 'passive', description: g[0].card?.description ?? '' }}>
              <div className="mt-3 flex items-center justify-between gap-3 text-xs">
                <span className="text-slate-400">{howToUse[g[0].card_code] ?? (g[0].card?.kind === 'luck' ? 'Pakai di meja online lewat tombol 🎒. Berlaku di hand berikutnya.' : '')}</span>
                <span className="shrink-0 rounded-lg bg-brand-400/15 px-2 py-1 text-sm font-bold text-brand-400">×{g.length}</span>
              </div>
            </CardTile>
          ))}
          {armed.map((c) => (
            <CardTile key={c.id} card={{ code: c.card_code, name: c.card?.name ?? c.card_code, kind: c.card?.kind ?? 'passive', description: c.card?.description ?? '' }}>
              <div className="mt-3 flex items-center justify-between gap-3 text-xs">
                <span className="font-semibold text-amber-300">⚡ Terpasang di match</span>
                {c.match_id && (
                  <Link to={`/matches/${c.match_id}`} className="font-semibold text-brand-400">
                    Lihat match ›
                  </Link>
                )}
              </div>
            </CardTile>
          ))}
        </div>
      )}

      {used.length > 0 && (
        <section>
          <SectionTitle>Sudah dipakai</SectionTitle>
          <Card className="divide-y divide-ink/5 p-0">
            {used.slice(0, 15).map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span>{c.card?.name ?? c.card_code}</span>
                <span className="text-xs text-slate-500">
                  {c.used_at && formatDate(c.used_at)}
                  {c.match_id && (
                    <Link to={`/matches/${c.match_id}`} className="ml-2 text-brand-400">
                      match ›
                    </Link>
                  )}
                </span>
              </div>
            ))}
          </Card>
        </section>
      )}
    </div>
  )
}

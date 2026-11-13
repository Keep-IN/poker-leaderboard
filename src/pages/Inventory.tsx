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
  shield: 'Pakai di meja lewat 🎒 saat hand berjalan, sebelum diserang: kartu Attack pertama ke kamu ditahan.',
  chip_saver: 'Pakai di meja lewat 🎒 saat hand berjalan: kalau nanti fold, setengah taruhanmu kembali.',
  second_chance: 'Pakai di meja lewat 🎒 saat hand berjalan: kalau chip habis di hand itu, kamu bertahan dengan 1 big blind.',
  blind_steal: 'Pakai di meja lewat 🎒 sebelum flop, pilih lawan yang memasang blind (SB/BB).',
  blindfold: 'Pakai di meja lewat 🎒 sebelum flop, pilih lawan: kartunya tertutup sampai flop.',
  freeze_player: 'Pakai di meja lewat 🎒 saat hand berjalan, pilih lawan: dia tidak bisa raise di hand itu.',
  tax_collector: 'Pakai di meja lewat 🎒 saat hand berjalan: ambil 10% chip lawan terkaya.',
  suited_up: 'Pakai di meja lewat 🎒: hand berikutnya 2 kartu tanganmu pasti satu jenis.',
  third_card: 'Pakai di meja lewat 🎒: hand berikutnya dibagi 3 kartu, disimpan 2 terbaik.',
  board_peek: 'Pakai di meja lewat 🎒 saat hand berjalan: lihat kartu meja berikutnya.',
  kings_ransom: 'Pakai di meja lewat 🎒 setelah match berjalan: awal hand berikutnya semua lawan bayar 1 big blind ke kamu.',
  chaos_shuffle: 'Pakai di meja lewat 🎒 saat hand berjalan: semua kartu tangan dikocok ulang.',
  death_card: 'Pakai di meja lewat 🎒 sebelum flop: 1 kartu yang dipegang seseorang jadi kartu kematian (−65% chip di showdown).',
  guardian_angel: 'Pakai di meja lewat 🎒 saat hand berjalan, pilih pemain lain: dia kebal tersingkir di hand itu.',
  share_luck: 'Pasang kartu Luck dulu, lalu pakai lewat 🎒 dan pilih pemain yang ikut kebagian.',
  chip_stack: 'Pasang di halaman match online sebelum match dimulai: chip awal +20%. Memakai 1 dari 3 jatah kartu.',
  card_sense: 'Pasang di halaman match online sebelum match dimulai: sekali per match tahu 1 kartu lawan saat flop. Memakai 1 jatah.',
  lucky_charm: 'Pasang di halaman match online sebelum match dimulai: peluang kartu Luck +15%. Memakai 1 jatah.',
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

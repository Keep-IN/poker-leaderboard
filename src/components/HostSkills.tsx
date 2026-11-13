import { useState } from 'react'
import { Card, SectionTitle } from './ui'

/** Skill card khusus host (sama dengan HOST_SKILLS di api/_lib/poker.js). Dipakai lewat tombol 🎩 di meja online. */
export const HOST_SKILLS = [
  { code: 'double_payout', icon: '💰', name: 'Double Payout', when: 'Saat hand berjalan', desc: 'Pot sekarang langsung dikali 2.' },
  { code: 'jackpot', icon: '🎰', name: 'Jackpot Hand', when: 'Saat hand berjalan', desc: 'Tambah 10× big blind ke pot hand ini.' },
  { code: 'open_hand', icon: '🃏', name: 'Open Hand', when: 'Saat hand berjalan', desc: 'Semua kartu pemain di hand ini terbuka untuk semua orang.' },
  { code: 'board_reroll', icon: '🌀', name: 'Board Reroll', when: 'Setelah flop', desc: 'Kartu meja yang sudah terbuka diganti kartu baru.' },
  { code: 'speed_round', icon: '⏱️', name: 'Speed Round', when: 'Kapan saja', desc: 'Waktu giliran cuma 10 detik di hand ini (atau hand berikutnya).' },
  { code: 'silence', icon: '🤐', name: 'Silence', when: 'Kapan saja', desc: 'Skill card pemain dikunci di hand ini (atau hand berikutnya).' },
  { code: 'blind_up', icon: '📈', name: 'Blind Up', when: 'Kapan saja', desc: 'Blind naik 1 level, berlaku mulai hand berikutnya.' },
  { code: 'all_in_madness', icon: '🤯', name: 'All-in Madness', when: 'Kapan saja', desc: 'Hand berikutnya semua pemain otomatis all-in.' },
  { code: 'bounty', icon: '🎯', name: 'Bounty', when: 'Kapan saja', desc: 'Tandai 1 pemain. Yang menyingkirkannya dapat bonus 50% chip awal.' },
  { code: 'charity', icon: '🎁', name: 'Charity', when: 'Kapan saja', desc: 'Pemain dengan chip paling sedikit dapat 50% chip awal.' },
  { code: 'lucky_spin', icon: '🎡', name: 'Lucky Spin', when: 'Kapan saja', desc: '1 pemain acak dapat kartu Luck gratis untuk hand berikutnya.' },
  { code: 'double_or_nothing', icon: '🎲', name: 'Double or Nothing', when: 'Saat hand berjalan', desc: 'Pemenang hand ini 50:50 dapat pot dobel atau cuma setengah (sisanya hangus).' },
  { code: 'split_pot', icon: '💥', name: 'Split Pot', when: 'Saat hand berjalan', desc: 'Pot dibagi rata ke 2 kombinasi terbaik di showdown.' },
  { code: 'insurance', icon: '🏦', name: 'Insurance', when: 'Saat hand berjalan', desc: 'Yang kalah all-in dapat kembali 25% chip yang dipertaruhkan.' },
  { code: 'spotlight', icon: '🔦', name: 'Spotlight', when: 'Saat hand berjalan', desc: '1 kartu tangan pemain pilihanmu dibuka ke semua orang.' },
  { code: 'freeze', icon: '🧊', name: 'Freeze', when: 'Kapan saja', desc: '1 pemain tidak bisa raise di hand ini (atau hand berikutnya).' },
  { code: 'hot_seat', icon: '🔥', name: 'Hot Seat', when: 'Kapan saja', desc: 'Kalau pemain yang ditandai menang hand itu, semua pemain lain bayar dia 1 big blind.' },
  { code: 'shot_clock', icon: '🎤', name: 'Shot Clock Duel', when: 'Kapan saja', desc: '2 pemain pilihanmu cuma punya 5 detik per giliran.' },
  { code: 'leader_tax', icon: '👑', name: 'Chip Leader Tax', when: 'Kapan saja', desc: 'Chip leader bayar 10% chip-nya, dibagi rata ke pemain lain.' },
  { code: 'seat_shuffle', icon: '🔀', name: 'Seat Shuffle', when: 'Kapan saja', desc: 'Semua pemain pindah kursi acak mulai hand berikutnya.' },
  { code: 'mystery_box', icon: '🎁', name: 'Mystery Box', when: 'Kapan saja', desc: '1 pemain acak dapat 1 skill card gratis langsung ke inventory.' },
  { code: 'final_table', icon: '🎆', name: 'Final Table', when: 'Pemain tinggal 3', desc: 'Meja menyala & musik makin cepat sampai juara ditemukan.' },
  { code: 'upside_down', icon: '🙃', name: 'Upside Down', when: 'Saat hand berjalan', desc: 'Hand ini kombinasi terlemah yang menang.' },
  { code: 'bonus_river', icon: '➕', name: 'Bonus River', when: 'Sebelum river', desc: 'Hand ini punya 6 kartu meja.' },
  { code: 'house_hand', icon: '👻', name: 'House Hand', when: 'Sebelum flop', desc: 'Bandar ikut main dengan 2 kartu terbuka; kalau bandar menang, separuh pot hangus.' },
  { code: 'mandatory_ante', icon: '💸', name: 'Mandatory Ante', when: 'Saat hand berjalan', desc: 'Semua yang masih ikut hand setor 5% chip ke pot.' },
  { code: 'coin_drop', icon: '🪙', name: 'Coin Drop', when: 'Saat hand berjalan', desc: 'Pemenang hand ini dapat 20 koin aplikasi.' },
  { code: 'prediction', icon: '🔮', name: 'Prediction', when: 'Saat hand berjalan', desc: 'Pemain tersingkir/fold menebak pemenang; benar = 10 koin.' },
  { code: 'blackout', icon: '🌑', name: 'Blackout', when: 'Kapan saja', desc: 'Semua pemain tidak bisa melihat kartunya sampai flop.' },
  { code: 'masquerade', icon: '🎭', name: 'Masquerade', when: 'Kapan saja', desc: 'Nama semua pemain disembunyikan selama 1 hand.' },
  { code: 'dice_blinds', icon: '🎲', name: 'Dice Blinds', when: 'Kapan saja', desc: 'Lempar dadu: blind hand berikutnya 1×–6×.' },
  { code: 'chip_rain', icon: '🌧️', name: 'Chip Rain', when: 'Kapan saja', desc: 'Semua pemain yang bertahan dapat bonus 10% chip awal.' },
  { code: 'revenge_vote', icon: '🗳️', name: 'Revenge Vote', when: 'Ada yang tersingkir', desc: 'Pemain tersingkir voting 1 pemain untuk kehilangan 10% chip.' },
]

export function HostSkillList() {
  const [open, setOpen] = useState(false)
  return (
    <section>
      <SectionTitle>🎩 Skill Bandar</SectionTitle>
      <Card className="space-y-3">
        <p className="text-sm text-slate-400">
          Gratis &amp; tanpa batas untuk host match online, maksimal 1 per hand, dan selalu diumumkan di meja. Buka meja, lalu ketuk tombol 🎩.
        </p>
        <div className={open ? 'grid gap-2 md:grid-cols-2' : 'grid gap-2 md:grid-cols-2 [&>*:nth-child(n+5)]:hidden'}>
          {HOST_SKILLS.map((s) => (
            <div key={s.code} className="flex gap-3 rounded-xl border border-violet-400/25 bg-violet-500/10 px-3 py-2.5">
              <span className="text-2xl leading-none">{s.icon}</span>
              <div className="min-w-0">
                <p className="font-semibold">
                  {s.name} <span className="text-[11px] font-normal text-violet-300">· {s.when}</span>
                </p>
                <p className="text-xs text-slate-400">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setOpen(!open)} className="min-h-10 w-full rounded-xl bg-ink/5 text-sm font-semibold text-slate-300 hover:bg-ink/10">
          {open ? 'Tutup' : `Lihat semua (${HOST_SKILLS.length})`}
        </button>
      </Card>
    </section>
  )
}

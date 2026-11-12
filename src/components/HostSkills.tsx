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

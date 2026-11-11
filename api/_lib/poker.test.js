// Tes mesin turnamen: `node api/_lib/poker.test.js` (mencetak "semua tes lulus").
import assert from 'node:assert'
import { AFK_HANDS, COUNTDOWN_MS, WILD_MS, LEVELS, REVEAL_MS, SKILLS, TURN_MS, Table, best, bestFive, equities, handName, rigLuck } from './poker.js'

const C = s => s.split(' ').map(x => 'shdc'.indexOf(x[1]) * 13 + '23456789TJQKA'.indexOf(x[0]))
const S = s => best(C(s))
assert(S('As Ks Qs Js Ts 2d 3c') > S('9h 9d 9s 9c 2d 3c 4c'))  // straight flush > quads
assert(S('Kh Kd Kc 2s 2h 9d 3c') > S('Ah 9h 7h 4h 2h Kd Kc'))  // full house > flush
assert(S('Ah 2d 3c 4s 5h 9d Kc') < S('2d 3c 4s 5h 6h 9d Kc'))  // wheel < 6-high straight
assert(S('Ah 2d 3c 4s 5h 9d Kc') > S('Ah Ad 3c 4s 9h Jd Kc'))  // wheel > pair
assert(S('Ah Ad Kc 4s 5h 9d 2c') > S('Ah Ad Qc 4s 5h 9d 2c'))  // kicker
assert.equal(handName(C('Ah Ad'), C('Ac Ks Kh')), 'Full House')
assert.deepEqual(bestFive(C('Ah Ad 2c 7d Ac Ks Kh')).sort(), C('Ah Ad Ac Ks Kh').sort()) // pilih 5 kartu terbaik dari 7
assert.equal(best(bestFive(C('9h 8h 2c 3d 7h 6h 5h'))), S('9h 8h 7h 6h 5h 2c 3d'))
{ // peluang menang (host): AA vs KK preflop ~82%, turn/river dihitung pasti
  const [a, k] = equities([C('As Ah'), C('Ks Kh')], [], 4000)
  assert(a > .77 && a < .87 && Math.abs(a + k - 1) < 1e-9, 'AA vs KK ' + a)
  assert.deepEqual(equities([C('Ac Kc'), C('Qd Qc')], C('Ad Qs 7h 2s')), [0, 1])
  assert.deepEqual(equities([C('As Kd'), C('Ah Kc')], C('2c 7d 9h Js 3c')), [.5, .5])
}

// ---- alat uji: waktu dikendalikan manual, kursi diurutkan P0, P1, ... supaya bisa diprediksi ----
const cfg = (o = {}) => ({ sb: 10, start_chips: 1000, level_minutes: 10, ...o })
const mk = (chips, o) => {
  const t = Table.create(chips.map((_, i) => ({ uid: 'u' + i, name: 'P' + i })), cfg(o), 1e6)
  t.players.sort((a, b) => a.uid.localeCompare(b.uid))
  t.players.forEach((p, i) => { p.chips = chips[i]; p.token = 'tok' + i; p.seen = t.now })
  t.players.forEach((_, i) => t.setReady(i, true)) // lobi: semua langsung Ready
  return t
}
const run = (t, ms) => { t.now += ms; t.players.forEach(p => { if (!p.off) p.seen = t.now }); t.tick() } // pemain yang tidak off terus "online"
const begin = t => run(t, t.due.at - t.now) // hand pertama
const drain = t => { while (t.phase !== 'showdown' && t.phase !== 'over' && t.due) run(t, Math.max(0, t.due.at - t.now)) }
const nxt = t => { while (!t.betting && t.due) run(t, Math.max(0, t.due.at - t.now)) }
const ok = (t, i, ...a) => assert.equal(t.act(i, ...a), undefined, `aksi ${a} oleh P${i} harus sukses`)
const bad = (t, i, ...a) => assert.equal(typeof t.act(i, ...a), 'string', `aksi ${a} oleh P${i} harus ditolak`)
const rig = (t, s) => { const seq = C(s); t.newDeck = () => seq.slice().reverse() } // kartu dibagi urut: tiap pemain 2, lalu board
const stacks = t => t.players.map(p => p.chips)
const reload = (t, now) => { const u = Table.from(JSON.parse(JSON.stringify(t))); u.now = now; return u } // seperti fungsi serverless

{ // lobi: belum dibagi sampai semua Ready; Out keluar dari meja; lalu hitung mundur
  const t = Table.create(['A', 'B', 'C', 'D'].map(x => ({ uid: x, name: x })), cfg(), 1e6)
  assert.equal(t.view(null).lobby, true); assert.equal(t.due, null)
  t.now += 600000; t.tick(); assert.equal(t.phase, 'waiting', 'tidak mulai sendiri tanpa Ready')
  t.setReady(0, true); t.setReady(1, true)
  assert.equal(t.view(null).countdown, false)
  assert.equal(t.setReady(1, false), undefined); assert.equal(t.players[1].ready, false) // batal Ready
  t.setReady(1, true); t.setReady(2, true)
  const d = t.players.findIndex(p => !p.ready)
  assert.equal(t.withdraw(d), undefined) // pemain terakhir Out: sisanya sudah Ready, hitung mundur jalan
  assert.equal(t.players.length, 3)
  assert.equal(t.view(null).countdown, true); assert(t.view(null).startIn > 0)
  assert.equal(typeof t.setReady(0, false), 'string', 'terkunci saat hitung mundur')
  assert.equal(typeof t.withdraw(0), 'string')
  t.now += COUNTDOWN_MS; t.tick()
  assert.equal(t.phase, 'preflop'); assert.equal(t.view(null).lobby, false)
  assert.equal(typeof t.withdraw(0), 'string', 'sesudah mulai tidak bisa Out')
  const two = Table.create([{ uid: 'a', name: 'a' }, { uid: 'b', name: 'b' }], cfg(), 0)
  assert.equal(typeof two.withdraw(0), 'string', 'minimal 2 pemain')
}

{ // meja baru: blind level awal sesuai pilihan dealer
  const t = mk([1500, 1500, 1500], { sb: 25 })
  assert.equal(t.phase, 'waiting')
  assert(t.view(t.players[0]).startIn > 0 && t.view(t.players[0]).countdown)
  begin(t)
  assert.equal(t.phase, 'preflop')
  assert.deepEqual([t.sb, t.bb], [25, 50])
  assert.deepEqual(t.players.map(p => p.bet), [0, 25, 50])
}

{ // side pot: all-in 100 / 300 / 500, kekuatan tangan P0 > P1 > P2; P0 yang menang semua sisanya tidak tersingkir
  const t = mk([100, 300, 500]); rig(t, 'As Ah Kd Kc 7c 2d 3h 8s 9d Tc 4h'); begin(t)
  ok(t, 0, 'raise', 100); ok(t, 1, 'raise', 300); ok(t, 2, 'raise', 500); drain(t)
  assert.deepEqual(stacks(t), [300, 400, 200])
  assert.deepEqual(t.out, [])
}

{ // heads-up: dealer = SB bertindak duluan preflop, BB punya option, postflop BB duluan
  const t = mk([1000, 1000]); begin(t)
  assert.deepEqual([t.dealer, t.turn], [0, 0])
  assert.deepEqual(t.players.map(p => p.bet), [10, 20])
  ok(t, 0, 'call'); assert.equal(t.turn, 1)
  ok(t, 1, 'check'); assert.deepEqual([t.phase, t.turn], ['flop', 1])
  ok(t, 1, 'check'); ok(t, 0, 'check'); assert.equal(t.phase, 'turn')
}

{ // min-raise dan all-in pendek
  const t = mk([1000, 1000, 1000]); begin(t)
  bad(t, 0, 'raise', 30); ok(t, 0, 'raise', 60)
  bad(t, 1, 'raise', 80); assert.equal(t.ctl(1).minTo, 100)
  const u = mk([1000, 1000, 130]); begin(u)
  ok(u, 0, 'raise', 100); ok(u, 1, 'call'); ok(u, 2, 'raise', 130)
  assert.deepEqual([u.ctl(0).raise, u.ctl(0).call], [false, 30])
}

{ // tersingkir: P1 kalah all-in -> peringkat 3; lalu heads-up sampai juara
  const t = mk([1000, 500, 1000]); rig(t, 'As Ah 2c 7d Kd Kc 9h 9s 4d Jc 3h'); begin(t)
  ok(t, 0, 'raise', 500); ok(t, 1, 'call'); ok(t, 2, 'fold'); drain(t)
  assert.deepEqual(stacks(t), [1520, 0, 980]) // P2 kehilangan big blind
  assert.deepEqual(t.out, ['u1'])
  assert.equal(t.players[1].place, 3)
  nxt(t)
  assert.deepEqual(t.players.map(p => p.inHand), [true, false, true]) // yang tersingkir tidak dibagi kartu lagi
  // heads-up: P2 all-in dan kalah
  rig(t, 'As Ah 2c 7d Kh 9d 4c 5s 3d') // P0 (stack besar) dapat AA
  t.phase = 'showdown'; t.due = { kind: 'next', at: t.now }; t.tick()
  const sb = t.turn
  ok(t, sb, 'raise', t.players[sb].chips + t.players[sb].bet)
  ok(t, t.turn, 'call'); drain(t)
  assert.equal(t.phase, 'over')
  assert.equal(t.out.length, 2)
  assert.equal(t.players.find(p => p.uid === t.winner).place, 1)
  assert.deepEqual(t.players.map(p => p.place).sort(), [1, 2, 3])
}

{ // showdown: urutan sorotan dari kombinasi terlemah ke terkuat, kartu sorotan = 5 kartu terbaik, jeda hand berikutnya cukup
  const t = mk([1000, 1000, 1000]); rig(t, 'Kc Kd 2c 7d As Ah Qh 9d 4c 5s Jd'); begin(t)
  ok(t, 0, 'call'); ok(t, 1, 'call'); ok(t, 2, 'check')
  for (let k = 0; k < 3; k++) for (let j = 0; j < 3; j++) if (t.turn >= 0) ok(t, t.turn, 'check')
  drain(t)
  assert.equal(t.phase, 'showdown')
  const v = t.view(t.players[1]), r = v.reveal
  assert.deepEqual(r.map(x => x.i), [1, 0, 2]) // 7-high < pasangan K < pasangan A
  assert.deepEqual(r.map(x => x.hand), ['High Card', 'One Pair', 'One Pair'])
  r.forEach(x => { assert.equal(x.best.length, 5); x.best.forEach(c => assert(t.players[x.i].cards.includes(c) || t.board.includes(c))) })
  assert(r[2].best.includes(t.players[2].cards[0]) && r[2].best.includes(t.players[2].cards[1]))
  assert(t.due.at - t.now >= 900 + 3 * REVEAL_MS)
  // menang tanpa showdown (semua fold): tidak ada sorotan
  const u = mk([1000, 1000, 1000]); begin(u); ok(u, 0, 'fold'); ok(u, 1, 'fold')
  assert.deepEqual(u.view(u.players[0]).reveal, [])
}

{ // AFK: istirahat AFK_HANDS hand berturut-turut = tersingkir, chip hangus, peringkat terburuk di hand itu
  const t = mk([1000, 1000, 1000]); begin(t)
  t.players[2].off = true; t.players[2].seen = -1e12 // P2 tidak pernah beraksi
  const play = () => { while (t.betting) { if (t.turn === 2 || t.turn < 0) run(t, Math.max(0, t.due.at - t.now)); else ok(t, t.turn, t.ctl(t.turn).call ? 'call' : 'check') } }
  for (let h = 0; h < AFK_HANDS - 1; h++) { play(); assert.equal(t.players[2].place, 0, 'belum boleh tersingkir'); nxt(t) }
  assert.equal(t.players[2].afk, AFK_HANDS - 1)
  play()
  assert.equal(t.players[2].afkOut, true)
  assert.equal(t.players[2].chips, 0)
  assert.deepEqual(t.out, ['u2'])
  assert.equal(t.players[2].place, 3)
  assert.equal(t.players.reduce((s, p) => s + p.chips, 0) + t.forfeited, 3000)
  assert.equal(t.view(t.players[0]).players[2].afkOut, true)
  // beraksi lagi atau "Main lagi" mengulang hitungan
  const u = mk([1000, 1000, 1000]); begin(u)
  u.players[1].afk = AFK_HANDS - 1; u.sitIn(1); assert.equal(u.players[1].afk, 0)
}

{ // semua yang tersisa AFK: yang chip-nya terbanyak tetap jadi juara, turnamen selesai
  const t = mk([500, 900, 700]); begin(t)
  t.players.forEach(p => { p.off = true; p.seen = -1e12 })
  for (let g = 0; g < 500 && t.phase !== 'over'; g++) run(t, Math.max(0, t.due.at - t.now))
  assert.equal(t.phase, 'over')
  assert.equal(t.players.filter(p => p.place === 1).length, 1)
  assert.equal(t.out.length, 2)
  assert(t.winner)
}

{ // Defend Me: yang kalah mendapat kembali setengah kerugiannya dari pemenang; total chip tetap; 1 kartu per hand
  const t = mk([1000, 1000, 1000]); rig(t, 'As Ah Kd Kc 2c 7d 9h 9s 4d Jc 3h'); begin(t)
  assert.equal(t.useCard(1, 'defend_me'), undefined)
  assert.equal(typeof t.useCard(1, 'defend_me'), 'string') // sudah pakai kartu di hand ini
  assert.equal(typeof t.useCard(0, 'reveal'), 'string')    // kartu yang belum ada mekanismenya
  assert.deepEqual(t.view(t.players[0]).players[1].skills, []) // lawan belum tahu sebelum showdown
  assert.deepEqual(t.view(t.players[1]).players[1].skills, ['defend_me'])
  ok(t, 0, 'raise', 1000); ok(t, 1, 'call'); ok(t, 2, 'fold'); drain(t)
  // P0 (AA) menang 2000+20 dari P1 (KK) dan blind P2; P1 rugi 1000 -> kembali 500
  assert.deepEqual(stacks(t), [1520, 500, 980])
  assert.equal(t.players[1].saved, 500)
  assert.equal(t.players[1].place, 0, 'tidak tersingkir karena setengah chip selamat')
  assert.deepEqual(t.view(t.players[0]).players[1].skills, ['defend_me']) // dibuka saat showdown
  // pemain yang menang dengan Defend Me tidak mendapat apa-apa tambahan
  const u = mk([1000, 1000]); rig(u, 'As Ah Kd Kc 2c 7d 9h 9s 4d'); begin(u)
  u.useCard(0, 'defend_me'); ok(u, 0, 'raise', 1000); ok(u, 1, 'call'); drain(u)
  assert.deepEqual(stacks(u), [2000, 0])
  // tidak bisa dipakai setelah fold atau di luar hand
  const w = mk([1000, 1000, 1000]); begin(w); ok(w, 0, 'fold')
  assert.equal(typeof w.useCard(0, 'defend_me'), 'string')
}

{ // Reveal Card: pemakai melihat kartu satu lawan sampai hand selesai; lawan lain dan korbannya tidak tahu sampai showdown
  const t = mk([1000, 1000, 1000]); rig(t, 'As Ah Kd Kc 2c 7d 9h 9s 4d Jc 3h'); begin(t)
  assert.equal(typeof t.useCard(0, 'reveal_card'), 'string')    // butuh target
  assert.equal(typeof t.useCard(0, 'reveal_card', 0), 'string') // tidak bisa ke diri sendiri
  assert.equal(t.useCard(0, 'reveal_card', 2), undefined)
  assert.deepEqual(t.view(t.players[0]).players[2].cards, t.players[2].cards)
  assert.equal(t.view(t.players[0]).players[2].peek, true)
  assert.deepEqual(t.view(t.players[0]).players[1].cards, [-1, -1])
  assert.deepEqual(t.view(t.players[1]).players[2].cards, [-1, -1])
  // diumumkan ke semua bahwa A memakai Reveal Card, tapi korbannya tidak (kartu yang diintip hanya terlihat pemakainya)
  assert.deepEqual(t.view(t.players[2]).players[0].skills, ['reveal_card'])
  assert.equal(t.view(t.players[2]).players[0].target, -1)
  assert.equal(t.view(t.players[0]).players[0].target, 2, 'pemakainya tahu targetnya sendiri')
  assert.deepEqual([t.view(t.players[1]).ann.by, t.view(t.players[1]).ann.code, t.view(t.players[1]).ann.target], [0, 'reveal_card', -1])
  ok(t, 0, 'call'); ok(t, 1, 'call'); ok(t, 2, 'check') // flop
  assert.equal(t.view(t.players[0]).players[2].hand, handName(t.players[2].cards, t.board)) // nama kombinasinya ikut
  ok(t, 1, 'check'); ok(t, 2, 'fold')
  assert.deepEqual(t.view(t.players[0]).players[2].cards, [], 'kartu yang sudah fold tidak terlihat lagi')
  ok(t, 0, 'check'); drain(t)
  assert.deepEqual(t.view(t.players[2]).players[0].skills, ['reveal_card']) // dibuka di akhir hand
  assert.equal(t.view(t.players[2]).players[0].target, -1, 'korban tetap dirahasiakan')
  nxt(t); assert.equal(t.players[0].target, -1) // hand baru, efeknya hilang
}

{ // Fold Player: hanya preflop, tidak ke pemain all-in, chip yang sudah ditaruh tetap di pot, langsung terlihat semua
  const t = mk([1000, 1000, 1000]); begin(t) // dealer P0 (giliran), SB P1, BB P2
  assert.equal(t.useCard(0, 'fold_player', 2), undefined) // BB dipaksa fold di luar gilirannya
  assert.equal(t.players[2].folded, true); assert.equal(t.turn, 0, 'giliran tidak berubah')
  assert.deepEqual(t.view(t.players[1]).players[0].skills, ['fold_player'])
  assert.equal(t.view(t.players[2]).players[2].forced, true)
  assert.equal(typeof t.useCard(1, 'fold_player', 2), 'string') // sudah fold
  ok(t, 0, 'call'); ok(t, 1, 'call')
  assert.equal(t.phase, 'flop', 'ronde selesai tanpa menunggu BB')
  assert.equal(typeof t.useCard(1, 'fold_player', 0), 'string') // sesudah flop tidak bisa
  drain(t); while (t.betting) ok(t, t.turn, 'check')
  assert.equal(stacks(t).reduce((a, b) => a + b, 0), 3000)
  assert.equal(stacks(t)[2], 980, 'blind BB tetap di pot')

  // korban sedang giliran: sama seperti fold sendiri, ronde bisa langsung selesai
  const u = mk([1000, 1000, 1000]); begin(u); ok(u, 0, 'call'); ok(u, 1, 'call')
  assert.equal(u.turn, 2)
  assert.equal(u.useCard(0, 'fold_player', 2), undefined)
  assert.equal(u.phase, 'flop')

  // heads-up: lawan dipaksa fold = pemakai langsung menang blind
  const h = mk([1000, 1000]); begin(h)
  assert.equal(h.useCard(0, 'fold_player', 1), undefined)
  assert.equal(h.phase, 'showdown'); assert.deepEqual(stacks(h), [1020, 980])

  // target all-in tidak bisa
  const a = mk([1000, 1000, 1000]); begin(a); ok(a, 0, 'raise', 1000)
  assert.equal(typeof a.useCard(1, 'fold_player', 0), 'string')
}

{ // kartu Luck: susunan selalu membentuk kombinasinya, dan kombinasinya tidak cuma dari kartu meja
  for (const [code, sk] of Object.entries(SKILLS).filter(([, x]) => x.luck)) for (let k = 0; k < 150; k++) {
    const r = rigLuck(sk.luck), all = r.hole.concat(r.board)
    assert.equal(new Set(all).size, 7, code)
    assert(all.every(c => c >= 0 && c < 52))
    assert.equal(handName(r.hole, r.board), sk.luck.cat === 8 ? 'Straight Flush' : handName(r.hole, r.board))
    if (sk.luck.royal) assert.equal(Math.floor(best(all) / 15 ** 4) % 15, 14, 'royal flush = straight flush as-tinggi')
    else assert.equal(Math.floor(best(all) / 15 ** 5), sk.luck.cat, code)
    assert(Math.floor(best(r.board) / 15 ** 5) < sk.luck.cat, code + ': kombinasi tidak boleh sudah jadi di kartu meja')
  }
}

{ // kartu Luck dipasang untuk hand berikutnya: satu untuk seluruh meja, pemiliknya mendapat kombinasinya kalau berhasil
  const t = mk([1000, 1000, 1000]); begin(t)
  SKILLS.give_me_full_house.chance = 100 // paksa berhasil untuk tes
  assert.equal(t.useCard(1, 'give_me_full_house'), undefined)
  assert.equal(typeof t.useCard(2, 'give_me_flush'), 'string', 'satu kartu Luck per hand di seluruh meja')
  assert.equal(typeof t.useCard(1, 'give_me_flush'), 'string')
  assert.equal(t.view(t.players[1]).luckNext, 'give_me_full_house')
  assert.equal(t.view(t.players[2]).luckBusy, true)
  assert.equal(t.view(t.players[0]).players[1].skills.length, 0, 'tidak terlihat lawan')
  assert.equal(t.useCard(1, 'defend_me'), undefined, 'kartu lain di hand sekarang tetap boleh')
  ok(t, 0, 'fold'); ok(t, 1, 'fold'); nxt(t)
  const o = t.players[1]
  assert.deepEqual(o.skills, ['give_me_full_house']); assert.equal(o.lucky, true)
  assert.equal(typeof t.useCard(1, 'defend_me'), 'string', 'kartu Luck dihitung sebagai kartu hand ini')
  assert.equal(t.view(o).lucky, undefined, 'hasil belum diberitahu selama hand berjalan')
  const dealt = t.players.flatMap(p => p.cards)
  assert.equal(new Set(dealt).size, 6)
  while (t.betting) ok(t, t.turn, t.ctl(t.turn).call ? 'call' : 'check')
  assert.equal(handName(o.cards, t.board), 'Full House')
  assert.equal(t.view(o).lucky, true); assert.equal(t.view(t.players[0]).lucky, undefined)
  assert.equal(new Set(dealt.concat(t.board)).size, 11, 'tidak ada kartu ganda')
  SKILLS.give_me_full_house.chance = 0 // gagal: hand biasa, kartu tetap terpakai
  nxt(t); t.useCard(0, 'give_me_full_house'); while (t.betting) ok(t, t.turn, t.ctl(t.turn).call ? 'call' : 'check'); nxt(t)
  assert.equal(t.players[0].lucky, false); assert.deepEqual(t.players[0].skills, ['give_me_full_house'])
  SKILLS.give_me_full_house.chance = 60
}

{ // Wildcard: dipasang selama hand, diumumkan sesudah hand selesai (jeda), lalu efeknya jalan sebelum hand dibagi
  const fin = t => { while (t.betting) ok(t, t.turn, t.ctl(t.turn).call ? 'call' : 'check') }
  const toShowdown = t => { fin(t); assert.equal(t.phase, 'showdown') }
  const nextDue = t => run(t, Math.max(0, t.due.at - t.now))

  // You Owe Me My Money: 80% chip target pindah ke pemakai
  let t = mk([1000, 1000, 1000, 1000]); begin(t)
  assert.equal(typeof t.useCard(0, 'you_owe_me'), 'string', 'butuh target')
  assert.equal(t.useCard(0, 'you_owe_me', 3), undefined)
  assert.equal(typeof t.useCard(1, 'get_out', 2), 'string', 'satu wildcard menunggu sekaligus')
  assert.equal(t.view(t.players[0]).wildNext, 'you_owe_me'); assert.equal(t.view(t.players[1]).wildBusy, true)
  assert.equal(t.view(t.players[3]).ann, undefined, 'belum diumumkan selama hand berjalan')
  ok(t, t.turn, 'fold'); ok(t, t.turn, 'fold'); ok(t, t.turn, 'fold') // hand cepat selesai
  const before = stacks(t), no = t.handNo
  nextDue(t) // waktu hand berikutnya: jeda pengumuman dulu, belum dibagi
  assert.equal(t.handNo, no); assert(!t.betting)
  const a = t.view(t.players[2]).ann
  assert.deepEqual([a.by, a.code, a.target, a.extra], [0, 'you_owe_me', 3, String(Math.floor(before[3] * 0.8))])
  assert.equal(t.due.at - t.now, WILD_MS)
  nextDue(t)
  assert.equal(t.handNo, no + 1)
  const take = Math.floor(before[3] * 0.8)
  assert.equal(t.players[3].stack0, before[3] - take); assert.equal(t.players[0].stack0, before[0] + take)

  // Get The F*ck Out!: target langsung tersingkir, chip hangus, peringkat terbawah
  t = mk([1000, 1000, 1000, 1000]); begin(t)
  assert.equal(t.useCard(2, 'get_out', 1), undefined)
  toShowdown(t); nextDue(t); nextDue(t)
  assert.equal(t.players[1].place, 4); assert.equal(t.players[1].chips, 0); assert(t.view(null).players[1].killed)
  assert.deepEqual(t.out, ['u1']); assert(t.forfeited > 0)
  assert(!t.players[1].inHand && t.betting)
  assert.equal(typeof t.useCard(0, 'get_out', 1), 'string', 'target yang sudah tersingkir tidak bisa')

  // Duel Me!: hand berikutnya hanya pemakai vs target, sisanya tidak dibagi kartu (tanpa bayar blind)
  t = mk([1000, 1000, 1000, 1000]); begin(t)
  assert.equal(t.useCard(0, 'duel_me', 2), undefined)
  toShowdown(t); nextDue(t); nextDue(t)
  assert.deepEqual(t.players.map(p => p.inHand), [true, false, true, false])
  assert.deepEqual(t.view(null).duel, [0, 2])
  assert.deepEqual([t.players[1].total, t.players[3].total], [0, 0])
  fin(t); nextDue(t)
  assert.equal(t.view(null).duel, undefined, 'hanya satu hand')
  assert.equal(t.players.filter(p => p.inHand).length, 4)

  // tidak bisa kalau pemain tinggal 2; batal kalau sebelum dijalankan pemain jadi tinggal 2 (kartu dikembalikan)
  const two = mk([1000, 1000]); begin(two)
  assert.equal(typeof two.useCard(0, 'get_out', 1), 'string')
  t = mk([1000, 1000, 1000]); begin(t)
  assert.equal(t.useCard(0, 'duel_me', 1, 'card-123'), undefined)
  t.players[2].chips = 0; t.players[2].allIn = true // anggap P2 bust di hand ini
  fin(t); nextDue(t)
  assert.deepEqual(t.refunds, [{ uid: 'u0', card: 'card-123' }]); assert.equal(t.wild, null)
  // dipasang di antara hand: langsung diumumkan tanpa menunggu lama
  t = mk([1000, 1000, 1000]); begin(t); fin(t)
  assert.equal(t.phase, 'showdown')
  assert.equal(t.useCard(1, 'you_owe_me', 0), undefined)
  assert(t.due.at - t.now <= 1500)
}

{ // dua pemain tersingkir di hand yang sama: stack awal hand lebih besar = peringkat lebih baik
  const t = mk([200, 300, 2000]); rig(t, '2c 7d 3c 8d As Ah Kh 9d 4c 5s Jd'); begin(t)
  ok(t, 0, 'raise', 200); ok(t, 1, 'raise', 300); ok(t, 2, 'call'); drain(t)
  assert.deepEqual(t.out, ['u0', 'u1'])
  assert.deepEqual(t.players.map(p => p.place), [3, 2, 1])
  assert.equal(t.phase, 'over')
  assert.equal(t.winner, 'u2')
}

{ // blind naik tiap level_minutes, berlaku mulai hand berikutnya
  const t = mk([5000, 5000, 5000], { level_minutes: 5 }); begin(t)
  assert.deepEqual([t.sb, t.bb], [10, 20])
  t.now += 5 * 60000
  assert.deepEqual(t.blinds(), [15, 30])
  assert.deepEqual([t.sb, t.bb], [10, 20]) // hand berjalan tidak berubah
  ok(t, t.turn, 'fold'); ok(t, t.turn, 'fold'); nxt(t)
  assert.deepEqual([t.sb, t.bb], [15, 30])
  assert.equal(t.view(t.players[0]).level, 2)
  t.now += 100 * 60 * 60000
  assert.deepEqual(t.blinds(), [LEVELS.at(-1), LEVELS.at(-1) * 2]) // berhenti di level terakhir
}

{ // timeout: auto fold lalu istirahat, tapi tetap dibagi kartu (turnamen) dan cuma diberi waktu singkat
  const t = mk([1000, 1000, 1000]); begin(t)
  run(t, TURN_MS - 1); assert.equal(t.players[0].folded, false)
  run(t, 1); assert.deepEqual([t.players[0].folded, t.players[0].sitOut], [true, true])
  ok(t, 1, 'fold'); nxt(t)
  assert.deepEqual(t.players.map(p => p.inHand), [true, true, true])
  // P0 sekarang SB? giliran berputar; saat giliran P0 tiba, batas waktunya pendek
  while (t.turn !== 0 && t.betting) ok(t, t.turn, t.ctl(t.turn).call ? 'call' : 'check')
  if (t.turn === 0) assert(t.due.at - t.now <= 3000)
}

{ // pemain yang tidak pernah membuka meja (offline) tetap dibagi kartu, lalu keluar karena AFK; turnamen tetap selesai
  let t = mk([300, 300, 300])
  t.players[2].off = true; t.players[2].seen = -1e12
  begin(t)
  let g = 0
  while (t.phase !== 'over' && ++g < 1e5) {
    t = reload(t, t.now)
    if (t.turn >= 0 && !t.players[t.turn].off) ok(t, t.turn, t.ctl(t.turn).call ? 'call' : 'check')
    else run(t, Math.max(0, t.due.at - t.now))
  }
  assert.equal(t.phase, 'over')
  assert.equal(t.out.length, 2)
  assert.equal(t.players.reduce((s, p) => s + p.chips, 0) + t.forfeited, 900)
  assert(t.players[2].afkOut, 'pemain yang tidak pernah membuka meja keluar karena AFK')
}

{ // privasi: kartu lawan, token, uid, dan dek tidak bocor ke pemain lain atau penonton
  const t = mk([1000, 1000, 1000]); begin(t)
  const v = t.view(t.players[0]), s = JSON.stringify(v), w = JSON.stringify(t.view(null))
  assert.deepEqual(v.players[1].cards, [-1, -1])
  assert.deepEqual(v.players[0].cards, t.players[0].cards)
  assert(!/tok\d|"u\d"|deck/.test(s + w), 'token/uid/dek bocor di view')
  assert(!/"cards":\[\d/.test(w), 'penonton tidak boleh melihat kartu tertutup')
}

{ // fuzz: aksi acak dan timeout, state selalu dimuat ulang dari JSON; chip tetap, urutan tersingkir konsisten, selalu selesai
  for (let round = 0; round < 300; round++) {
    const n = 3 + (round % 6), R = k => Math.random() * k | 0
    let t = mk(Array.from({ length: n }, () => 200 + R(800)), { level_minutes: 1 + R(3) })
    const total = t.players.reduce((s, p) => s + p.chips, 0)
    begin(t)
    let g = 0
    while (t.phase !== 'over' && ++g < 2e5) {
      t = reload(t, t.now + R(4000))
      if (t.turn >= 0) {
        const i = t.turn, c = t.ctl(i), r = Math.random()
        if (r < .03) { // boleh gagal (fold/sudah pakai/target salah): tidak mengubah apa-apa
          const code = ['defend_me', 'reveal_card', 'fold_player', 'give_me_flush', 'give_me_royal_flush', 'you_owe_me', 'duel_me', 'get_out'][R(8)]
          if (t.useCard(R(n), code, R(n)) === undefined && code === 'fold_player') continue // giliran bisa berubah
        }
        if (r < .05) run(t, TURN_MS)
        else if (r < .2) ok(t, i, 'fold')
        else if (r < .6 || !c.raise) ok(t, i, c.call ? 'call' : 'check')
        else ok(t, i, 'raise', c.minTo + R(c.maxTo - c.minTo + 1))
      } else if (t.due) run(t, Math.max(0, t.due.at - t.now))
      assert(t.players.every(p => p.chips >= 0))
      if (!t.betting) assert.equal(t.players.reduce((s, p) => s + p.chips, 0) + t.forfeited, total)
      if (t.turn >= 0) { const p = t.players[t.turn]; assert(p.inHand && !p.folded && !p.allIn && p.chips > 0, 'giliran jatuh ke pemain yang salah') }
    }
    assert.equal(t.phase, 'over', 'turnamen macet')
    assert.equal(t.out.length, n - 1)
    assert.equal(new Set(t.out).size, n - 1)
    assert(!t.out.includes(t.winner))
    assert.deepEqual(t.players.map(p => p.place).sort((a, b) => a - b), Array.from({ length: n }, (_, i) => i + 1))
    // peringkat cocok dengan urutan tersingkir
    t.out.forEach((uid, k) => assert.equal(t.players.find(p => p.uid === uid).place, n - k))
  }
}

console.log('semua tes lulus')

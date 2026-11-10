// Tes mesin turnamen: `node api/_lib/poker.test.js` (mencetak "semua tes lulus").
import assert from 'node:assert'
import { LEVELS, TURN_MS, Table, best, handName } from './poker.js'

const C = s => s.split(' ').map(x => 'shdc'.indexOf(x[1]) * 13 + '23456789TJQKA'.indexOf(x[0]))
const S = s => best(C(s))
assert(S('As Ks Qs Js Ts 2d 3c') > S('9h 9d 9s 9c 2d 3c 4c'))  // straight flush > quads
assert(S('Kh Kd Kc 2s 2h 9d 3c') > S('Ah 9h 7h 4h 2h Kd Kc'))  // full house > flush
assert(S('Ah 2d 3c 4s 5h 9d Kc') < S('2d 3c 4s 5h 6h 9d Kc'))  // wheel < 6-high straight
assert(S('Ah 2d 3c 4s 5h 9d Kc') > S('Ah Ad 3c 4s 9h Jd Kc'))  // wheel > pair
assert(S('Ah Ad Kc 4s 5h 9d 2c') > S('Ah Ad Qc 4s 5h 9d 2c'))  // kicker
assert.equal(handName(C('Ah Ad'), C('Ac Ks Kh')), 'Full House')

// ---- alat uji: waktu dikendalikan manual, kursi diurutkan P0, P1, ... supaya bisa diprediksi ----
const cfg = (o = {}) => ({ sb: 10, start_chips: 1000, level_minutes: 10, ...o })
const mk = (chips, o) => {
  const t = Table.create(chips.map((_, i) => ({ uid: 'u' + i, name: 'P' + i })), cfg(o), 1e6)
  t.players.sort((a, b) => a.uid.localeCompare(b.uid))
  t.players.forEach((p, i) => { p.chips = chips[i]; p.token = 'tok' + i; p.seen = t.now })
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

{ // meja baru: belum dibagi sampai jeda awal lewat, lalu blind level awal sesuai pilihan dealer
  const t = mk([1500, 1500, 1500], { sb: 25 })
  assert.equal(t.phase, 'waiting')
  assert.equal(t.view(t.players[0]).startIn, 15000)
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

{ // pemain yang tidak pernah membuka meja (offline) tetap ikut dan habis dimakan blind; turnamen tetap selesai
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
  assert.equal(t.players.reduce((s, p) => s + p.chips, 0), 900)
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
        if (r < .05) run(t, TURN_MS)
        else if (r < .2) ok(t, i, 'fold')
        else if (r < .6 || !c.raise) ok(t, i, c.call ? 'call' : 'check')
        else ok(t, i, 'raise', c.minTo + R(c.maxTo - c.minTo + 1))
      } else if (t.due) run(t, Math.max(0, t.due.at - t.now))
      assert(t.players.every(p => p.chips >= 0))
      if (!t.betting) assert.equal(t.players.reduce((s, p) => s + p.chips, 0), total)
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

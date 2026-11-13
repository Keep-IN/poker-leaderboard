// Mesin Texas Hold'em mode turnamen untuk match online.
// Diadaptasi dari Meja Hold'em karya Ragil (github.com/ragila/meja-holdem), dipakai dengan izin.
//
// Kartu = int 0..51: rank = c%13+2, suit = c/13|0 (s,h,d,c).
// Seluruh state bisa di-JSON-kan (JSON.stringify(t) / Table.from) supaya bisa disimpan di database dan dipakai fungsi
// serverless yang tidak punya memori. Tidak ada timer: pemanggil mengisi t.now, lalu t.tick() menjalankan event
// terjadwal (timeout giliran, hand berikutnya, runout) yang sudah jatuh tempo.
//
// Bedanya dengan versi aslinya:
// - Kursi tetap: pemain diambil dari daftar pemain match, tidak ada gabung/keluar/rebuy di tengah game.
// - Blind naik tiap `levelMs` mengikuti LEVELS, mulai dari level yang dipilih dealer.
// - Pemain yang chip-nya habis tersingkir. Urutan tersingkir dicatat di `out`; sisa satu pemain = juara.
// - Pemain yang tidak aktif (offline atau istirahat) tetap dibagi kartu dan otomatis check/fold dengan cepat,
//   jadi turnamen tetap berjalan dan stack-nya habis dimakan blind.
// Self-test: `node api/_lib/poker.test.js`
import { randomInt } from 'node:crypto'

/** Small blind per level; big blind selalu 2× small blind. */
export const LEVELS = [10, 15, 25, 50, 75, 100, 150, 200, 300, 400, 500, 750, 1000, 1500, 2000, 3000, 4000, 5000, 7500, 10000, 15000, 20000, 30000, 50000]
const ONLINE_MS = 20000
/** Pemain yang AFK (istirahat karena kehabisan waktu, tidak beraksi) sebanyak ini hand berturut-turut langsung tersingkir. */
export const AFK_HANDS = 4
// waktu bisa dipercepat lewat env untuk pengujian
const env = (k, d) => +(globalThis.process?.env?.[k] ?? '') || d
export const TURN_MS = env('TURN_MS', 20000)
const AWAY_MS = env('AWAY_MS', 3000), NEXT_MS = env('NEXT_MS', 6000), RUNOUT_MS = env('RUNOUT_MS', 1500)
/** Hitung mundur 3-2-1 setelah semua pemain Ready di lobi meja (lebih dari 3 detik: layar pemain bisa telat ~1 detik). */
export const COUNTDOWN_MS = env('COUNTDOWN_MS', 4200)
const HANDS = ['High Card', 'One Pair', 'Two Pair', 'Three of a Kind', 'Straight', 'Flush', 'Full House', 'Four of a Kind', 'Straight Flush']
const BASE = 15 ** 5, cat = s => s / BASE | 0

function score5(cs) {
  const r = cs.map(c => c % 13 + 2).sort((a, b) => b - a), flush = cs.every(c => (c / 13 | 0) === (cs[0] / 13 | 0)), cnt = {}
  r.forEach(x => cnt[x] = (cnt[x] || 0) + 1)
  const g = Object.keys(cnt).map(Number).sort((a, b) => cnt[b] - cnt[a] || b - a), shape = g.map(x => cnt[x]).join('')
  const hi = g.length === 5 ? (r[0] - r[4] === 4 ? r[0] : r[0] === 14 && r[1] === 5 ? 5 : 0) : 0 // 5 = wheel A-2-3-4-5
  const [c, tb] = hi && flush ? [8, [hi]] : shape === '41' ? [7, g] : shape === '32' ? [6, g] : flush ? [5, g]
    : hi ? [4, [hi]] : shape === '311' ? [3, g] : shape === '221' ? [2, g] : shape === '2111' ? [1, g] : [0, g]
  return tb.concat([0, 0, 0, 0, 0]).slice(0, 5).reduce((a, x) => a * 15 + x, c)
}
// skor terbaik dari semua kombinasi 5 kartu (5-7 kartu masuk)
export function best(cs, from = 0, pick = []) {
  if (pick.length === 5) return score5(pick)
  let m = 0
  for (let i = from; i < cs.length; i++) m = Math.max(m, best(cs, i + 1, [...pick, cs[i]]))
  return m
}
export const handName = (cards, board) => HANDS[cat(best(cards.concat(board)))]
// Lima kartu yang membentuk kombinasi terbaik (untuk disorot saat showdown).
export function bestFive(cs) {
  let top = -1, pick = []
  const walk = (from, cur) => {
    if (cur.length === 5) { const sc = score5(cur); if (sc > top) { top = sc; pick = cur } return }
    for (let i = from; i < cs.length; i++) walk(i + 1, [...cur, cs[i]])
  }
  walk(0, [])
  return pick
}
// Peluang menang tiap tangan yang kartunya diketahui (dipakai untuk host): kartu meja yang belum dibuka dihitung semua
// kemungkinannya (turn/river) atau diacak (preflop). Seri dihitung sebagai bagian pot. Hasil: 0..1 per tangan.
const COMBO7 = []
for (let a = 0; a < 7; a++) for (let b = a + 1; b < 7; b++) COMBO7.push([0, 1, 2, 3, 4, 5, 6].filter(i => i !== a && i !== b))
const best7 = cs => { let m = 0; for (const h of COMBO7) { const v = score5(h.map(i => cs[i])); if (v > m) m = v } return m }
export function equities(hands, board, iters = 1200) {
  const used = new Set([...board, ...hands.flat()]), rest = [...Array(52).keys()].filter(c => !used.has(c))
  const need = 5 - board.length, share = hands.map(() => 0)
  const run = extra => {
    const b = board.concat(extra), sc = hands.map(h => best7(h.concat(b))), top = Math.max(...sc), w = sc.filter(v => v === top).length
    sc.forEach((v, i) => { if (v === top) share[i] += 1 / w })
  }
  let n = 0
  if (need > 2) for (; n < iters; n++) { const d = rest.slice(); for (let i = 0; i < need; i++) { const j = i + randomInt(d.length - i); [d[i], d[j]] = [d[j], d[i]] } run(d.slice(0, need)) }
  else if (need === 2) for (let i = 0; i < rest.length; i++) for (let j = i + 1; j < rest.length; j++) { run([rest[i], rest[j]]); n++ }
  else if (need === 1) for (const c of rest) { run([c]); n++ }
  else { run([]); n = 1 }
  return share.map(v => v / n)
}
/** Skill card yang mekanismenya ada di meja (kode sama dengan tabel skill_cards). */
// target: kartu yang perlu memilih lawan. open: langsung terlihat semua pemain (Fold Player jelas terasa korbannya);
// kartu lain baru terlihat pemain lain saat kartu dibuka di akhir hand.
export const SKILLS = {
  defend_me: { name: 'Defend Me', icon: '🛡️' },
  reveal_card: { name: 'Reveal Card', icon: '👁️', target: true, open: true, secret: true }, // secret: korbannya tidak diumumkan
  fold_player: { name: 'Fold Player', icon: '🚫', target: true, open: true },
  // Luck: dipasang untuk hand berikutnya. Saat hand itu dibagi, dengan peluang `chance`% kartu pemiliknya + kartu meja
  // disusun supaya kombinasi `cat` terbentuk (minimal satu kartu tangannya ikut membentuk kombinasi itu).
  give_me_straight: { name: 'Give Me A Straight', icon: '🪜', luck: { cat: 4 }, chance: 70 },
  give_me_flush: { name: 'Give Me A Flush', icon: '💧', luck: { cat: 5 }, chance: 70 },
  give_me_full_house: { name: 'Give Me A Full House', icon: '🏠', luck: { cat: 6 }, chance: 60 },
  give_me_quads: { name: 'Give Me A Four of a Kind', icon: '🎲', luck: { cat: 7 }, chance: 40 },
  give_me_straight_flush: { name: 'Give Me A Straight Flush', icon: '🌈', luck: { cat: 8 }, chance: 30 },
  give_me_royal_flush: { name: 'Give Me A Royal Flush', icon: '👑', luck: { cat: 8, royal: true }, chance: 15 },
  // Pair Me Up: pasti dapat pocket pair (2 kartu tangan rank sama) di hand berikutnya; kartu meja dibagi biasa.
  pair_me_up: { name: 'Pair Me Up', icon: '👯', luck: { pair: true }, chance: 100 },
  // Wildcard: menarget pemain lain yang masih bertahan; dijalankan sesudah hand berjalan selesai, didahului jeda
  // pengumuman di tengah meja. Tidak bisa dipakai (dan batal, kartu dikembalikan) kalau pemain tersisa tinggal 2.
  you_owe_me: { name: 'You Owe Me My Money', icon: '💸', wild: true },
  // Duel Me!: berlaku langsung di hand yang sedang berjalan, sebelum kartu ke-4 (turn) dibuka. Semua pemain lain
  // dipaksa fold (tanpa denda, chip yang sudah masuk tetap di pot) sehingga sisa hand jadi duel pemakai vs target.
  // Seperti Go Big or Go Home!, target cuma boleh call/raise: kalau fold, BIG_SHARE chip-nya masuk pot.
  duel_me: { name: 'Duel Me!', icon: '⚔️', target: true, open: true, cursed: true },
  get_out: { name: 'Get The F*ck Out!', icon: '💀', wild: true },
  // Go Big or Go Home!: wildcard yang langsung berlaku di hand yang sedang berjalan. Lawan yang fold sesudahnya
  // kehilangan BIG_SHARE chip-nya ke pot (kecuali dipaksa fold oleh kartu lain). Tidak bisa dipakai kalau pemain tinggal 2.
  go_big: { name: 'Go Big or Go Home!', icon: '🔥', open: true, big: true },
  // Card Reroll: 2 kartu tangan dikembalikan ke bandar, diganti 2 kartu baru dari dek.
  card_reroll: { name: 'Card Reroll', icon: '🔄', open: true },
  // Angelic: Revive Card menghidupkan pemain yang sudah tersingkir (boleh dirinya sendiri) dengan chip awal match.
  // Langsung diumumkan; pemain itu ikut lagi mulai hand berikutnya. Tidak bisa dipakai kalau pemain tersisa tinggal 2.
  revive: { name: 'Revive Card', icon: '😇', angel: true },
  // ---- batch 3 ----
  // Defend: Shield menahan 1 kartu Attack (diam-diam); Chip Saver: fold = setengah chip yang ditaruh kembali;
  // Second Chance: tersingkir di hand ini = bertahan dengan 1 big blind.
  shield: { name: 'Shield', icon: '🪖' },
  chip_saver: { name: 'Chip Saver', icon: '💤' },
  second_chance: { name: 'Second Chance', icon: '🔂' },
  // Attack
  blind_steal: { name: 'Blind Steal', icon: '🕳️', target: true, open: true },
  blindfold: { name: 'Blindfold', icon: '🙈', target: true, open: true },
  freeze_player: { name: 'Freeze Player', icon: '🧊', target: true, open: true },
  tax_collector: { name: 'Tax Collector', icon: '💣', open: true },
  // Luck: Suited Up & Third Card untuk hand berikutnya; Board Peek langsung (lihat kartu meja berikutnya)
  suited_up: { name: 'Suited Up', icon: '♠️', luck: { suited: true }, chance: 100 },
  third_card: { name: 'Third Card', icon: '🎴', luck: { third: true }, chance: 100 },
  board_peek: { name: 'Board Peek', icon: '🔮' },
  // Wildcard
  kings_ransom: { name: "King's Ransom", icon: '🤴', ransom: true },
  chaos_shuffle: { name: 'Chaos Shuffle', icon: '🌪️', open: true, cursed: true },
  death_card: { name: 'Death Card', icon: '💀', open: true, cursed: true },
  // Angelic
  guardian_angel: { name: 'Guardian Angel', icon: '🕊️', target: true, open: true, guard: true },
  share_luck: { name: 'Share the Luck', icon: '💞', target: true, share: true },
}
/** Kartu Attack (bisa ditahan Shield). */
export const ATTACKS = ['fold_player', 'reveal_card', 'blindfold', 'freeze_player', 'blind_steal', 'tax_collector']
/** Passive yang dipasang sebelum match (selain Double Down yang dihitung di poin): kode -> efek di meja. */
export const PASSIVES = ['full_counter', 'chip_stack', 'card_sense', 'lucky_charm']
export const DEATH_SHARE = 0.65, TAX_COLLECT = 0.1, STACK_BONUS = 0.2, CHARM_BONUS = 15, GUARD_SHARE = 0.25
// ---- skill card khusus host (bandar): tanpa batas & gratis, tapi maks 1 per hand; setiap pemakaian diumumkan ----
// now: hanya selama hand berjalan. target: pilih 1 pemain yang masih bertahan.
export const HOST_SKILLS = {
  double_payout: { name: 'Double Payout', icon: '💰', now: true },
  jackpot: { name: 'Jackpot Hand', icon: '🎰', now: true },
  blind_up: { name: 'Blind Up', icon: '📈' },
  speed_round: { name: 'Speed Round', icon: '⏱️' },
  all_in_madness: { name: 'All-in Madness', icon: '🤯' },
  open_hand: { name: 'Open Hand', icon: '🃏', now: true },
  board_reroll: { name: 'Board Reroll', icon: '🌀', now: true },
  bounty: { name: 'Bounty', icon: '🎯', target: true },
  silence: { name: 'Silence', icon: '🤐' },
  charity: { name: 'Charity', icon: '🎁' },
  lucky_spin: { name: 'Lucky Spin', icon: '🎡' },
  seat_shuffle: { name: 'Seat Shuffle', icon: '🔀' },
  double_or_nothing: { name: 'Double or Nothing', icon: '🎲', now: true },
  leader_tax: { name: 'Chip Leader Tax', icon: '👑' },
  spotlight: { name: 'Spotlight', icon: '🔦', now: true, target: 'hand' },
  freeze: { name: 'Freeze', icon: '🧊', target: 'hand' },
  insurance: { name: 'Insurance', icon: '🏦', now: true },
  split_pot: { name: 'Split Pot', icon: '💥', now: true },
  mystery_box: { name: 'Mystery Box', icon: '🎁' },
  hot_seat: { name: 'Hot Seat', icon: '🔥', target: 'hand' },
  shot_clock: { name: 'Shot Clock Duel', icon: '🎤', target: 'two' },
  final_table: { name: 'Final Table', icon: '🎆' },
}
// target: true = pemain yang masih bertahan; 'hand' = masih ikut hand ini (atau hand berikutnya kalau di antara hand);
// 'two' = dua pemain berbeda yang masih bertahan.
export const SHOT_MS = env('SHOT_MS', 5000)
export const TAX_SHARE = 0.1, INSURE_SHARE = 0.25
/** Kartu yang bisa keluar dari Mystery Box (skill card pemain, termasuk passive untuk match berikutnya). */
export const BOX_CARDS = ['defend_me', 'reveal_card', 'fold_player', 'card_reroll', 'pair_me_up', 'give_me_straight', 'give_me_flush', 'give_me_full_house',
  'give_me_quads', 'give_me_straight_flush', 'give_me_royal_flush', 'you_owe_me', 'duel_me', 'get_out', 'go_big', 'revive', 'double_down', 'full_counter',
  'shield', 'chip_saver', 'second_chance', 'blind_steal', 'blindfold', 'freeze_player', 'tax_collector', 'suited_up', 'third_card', 'board_peek',
  'kings_ransom', 'chaos_shuffle', 'death_card', 'guardian_angel', 'share_luck', 'chip_stack', 'card_sense', 'lucky_charm']
export const SPEED_MS = env('SPEED_MS', 10000)
/** Jackpot Hand: chip bonus = JACKPOT_BB x big blind. Charity & Bounty: bagian dari chip awal match. */
export const JACKPOT_BB = 10, CHARITY_SHARE = 0.5, BOUNTY_SHARE = 0.5
/** Kartu Attack yang dipantulkan Full Counter (passive yang dipasang sebelum match: t.counter = daftar uid pemiliknya). */
export const COUNTERED = ['fold_player', 'reveal_card']
/** Jeda pengumuman wildcard sebelum hand berikutnya dibagi. */
export const WILD_MS = env('WILD_MS', 5000)
/** Bagian chip target yang diambil You Owe Me My Money. */
export const OWE_SHARE = 0.8
/** Bagian chip yang masuk pot kalau fold saat Go Big or Go Home! aktif. */
export const BIG_SHARE = 0.5

// ---- kartu Luck: menyusun 2 kartu tangan + 5 kartu meja yang membentuk kombinasi tertentu ----
const R = n => randomInt(n), card = (rank, suit) => suit * 13 + rank - 2 // rank 2..14
const ROYAL = score5([12, 11, 10, 9, 8]) // A K Q J T sekop
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = R(i + 1); [a[i], a[j]] = [a[j], a[i]] } return a }
// lima kartu inti kombinasi
function core(t) {
  const suits = () => [R(4), R(4), R(4), R(4), R(4)]
  const run = (hi, ss) => [0, 1, 2, 3, 4].map(k => card(hi - k === 1 ? 14 : hi - k, ss[k])) // hi 5 = wheel (A sebagai 1)
  const ranks = (n, not = []) => shuffle([...Array(13)].map((_, k) => k + 2).filter(r => !not.includes(r))).slice(0, n)
  if (t.royal) return run(14, Array(5).fill(R(4)))
  if (t.cat === 8) return run(5 + R(9), Array(5).fill(R(4)))
  if (t.cat === 7) { const [a, b] = ranks(2); return [0, 1, 2, 3].map(x => card(a, x)).concat(card(b, R(4))) }
  if (t.cat === 6) { const [a, b] = ranks(2); return shuffle([0, 1, 2, 3]).slice(0, 3).map(x => card(a, x)).concat(shuffle([0, 1, 2, 3]).slice(0, 2).map(x => card(b, x))) }
  if (t.cat === 5) { const x = R(4); return ranks(5).map(r => card(r, x)) }
  return run(5 + R(10), suits()) // straight (kalau kebetulan satu warna, dicek ulang di bawah)
}
/** {hole, board} yang membentuk kombinasi t untuk pemiliknya, atau null kalau gagal menyusun. */
export function rigLuck(t) {
  const ok = sc => t.royal ? sc === ROYAL : cat(sc) === t.cat
  for (let tries = 0; tries < 200; tries++) {
    const five = core(t), rest = shuffle([...Array(52).keys()].filter(c => !five.includes(c)))
    const k = 1 + R(2), mine = shuffle(five.slice()), hole = mine.slice(0, k).concat(rest.slice(0, 2 - k))
    const board = shuffle(mine.slice(k).concat(rest.slice(2 - k, 2 - k + 5 - (5 - k)))) // sisa inti + pengisi = 5
    if (board.length !== 5 || new Set(hole.concat(board)).size !== 7) continue
    if (!ok(best(hole.concat(board)))) continue
    if (cat(best(board)) >= t.cat) continue // kombinasinya harus milik pemain, bukan kartu meja yang dipakai semua orang
    return { hole, board }
  }
  return null
}
// Kekuatan 2 kartu tangan sebelum flop (skor sederhana ala Chen): pair > kartu tinggi > suited > berdekatan.
export function holeScore(a, b) {
  const ra = a % 13 + 2, rb = b % 13 + 2, hi = Math.max(ra, rb), lo = Math.min(ra, rb)
  if (ra === rb) return 100 + ra * 2
  return hi * 2 + lo + (((a / 13) | 0) === ((b / 13) | 0) ? 4 : 0) + Math.max(0, 4 - (hi - lo))
}
const has = (t, code, uid) => !!t.passives?.[code]?.includes(uid)
// Jeda tambahan sebelum hand berikutnya: tiap kombinasi pemain disorot bergantian di layar.
export const REVEAL_MS = env('REVEAL_MS', 3000), REVEAL_LEAD_MS = 900

export class Table {
  constructor() {
    Object.assign(this, {
      players: [], board: [], deck: [], phase: 'waiting', dealer: -1, turn: -1, bet: 0, minRaise: 0, due: null,
      started: false, hands: 0, handNo: 0, now: 0,
      level0: 0, levelMs: 10 * 60000, startedAt: null, sb: 0, bb: 0, out: [], winner: null, forfeited: 0,
    })
  }
  /**
   * Meja baru untuk satu match. seats = [{ uid, name }] (diacak di sini), cfg = { sb, start_chips, level_minutes }.
   * Meja dimulai di lobi: tiap pemain menekan Ready (atau Out = keluar dari match). Setelah semua Ready,
   * hitung mundur COUNTDOWN_MS lalu hand pertama dibagi.
   */
  static create(seats, cfg, now) {
    const t = new Table()
    t.now = now
    const order = seats.slice()
    for (let i = order.length - 1; i > 0; i--) { const j = randomInt(i + 1); [order[i], order[j]] = [order[j], order[i]] }
    for (const s of order) t.players.push({
      uid: s.uid, name: String(s.name).slice(0, 20), token: null, chips: cfg.start_chips, seen: 0, sitOut: false,
      inHand: false, folded: false, allIn: false, acted: false, noRaise: false, show: false, cards: [], bet: 0, total: 0,
      score: 0, won: 0, last: '', stack0: 0, place: 0, afk: 0, afkOut: false, ready: false,
    })
    t.level0 = Math.max(0, LEVELS.indexOf(cfg.sb))
    t.levelMs = cfg.level_minutes * 60000
    ;[t.sb, t.bb] = t.blinds()
    t.started = true
    t.lobby = true
    t.startChips = cfg.start_chips
    return t
  }
  static from(o) { return Object.assign(new Table(), o) }
  toJSON() { const { now, ...rest } = this; return rest } // `now` bukan bagian dari state yang disimpan
  newDeck() { const d = [...Array(52).keys()]; for (let i = 51; i > 0; i--) { const j = randomInt(i + 1); [d[i], d[j]] = [d[j], d[i]] } return d }
  get betting() { return ['preflop', 'flop', 'turn', 'river'].includes(this.phase) }
  find(token) { return token ? this.players.find(p => p.token === token) : undefined }
  online(p) { return this.now - p.seen < ONLINE_MS } // online = baru saja menghubungi server
  alive() { return this.players.filter(p => p.chips > 0) }
  after(i, f) { const n = this.players.length; for (let k = 1; k <= n; k++) { const j = (i + k + n) % n; if (f(this.players[j])) return j } return -1 }

  /** Level blind saat ini (dihitung dari waktu mulai), sebagai [sb, bb]. */
  level() { return Math.min(LEVELS.length - 1, this.level0 + (this.levelUp || 0) + (this.startedAt === null ? 0 : Math.floor((this.now - this.startedAt) / this.levelMs))) }
  blinds() { const sb = LEVELS[this.level()]; return [sb, sb * 2] }

  // Hanya satu event terjadwal pada satu waktu; yang terbaru menggantikan yang lama.
  defer(kind, ms) { this.due = { kind, at: this.now + ms } }
  tick() {
    for (let i = 0; i < 20 && this.due && this.due.at <= this.now; i++) {
      const { kind } = this.due; this.due = null
      if (kind === 'turn') this.timeout(); else if (kind === 'runout') this.advance(); else this.startHand()
    }
  }

  startHand() {
    if (this.betting || this.phase === 'over') return
    if (this.wild && this.wildStage()) return // jeda pengumuman wildcard dulu
    this.applyRevive()
    this.applyRansom()
    let el = this.alive()
    if (el.length < 2) return this.end()
    this.duel = null
    this.big = -1
    this.duelFine = -1
    if (this.duelNext) { // Duel Me!: hand ini hanya dua pemain itu; sisanya tidak dibagi kartu (auto fold)
      const pair = this.duelNext.map(u => this.players.find(p => p.uid === u)).filter(p => p && el.includes(p))
      this.duelNext = null
      if (pair.length === 2) { el = pair; this.duel = pair.map(p => this.players.indexOf(p)) }
    }
    if (this.shuffleNext) { this.shuffleSeats(); el = this.duel ? this.duel.map(k => this.players[k]) : el }
    if (this.startedAt === null) { // hand pertama: passive Chip Stack (+20% chip awal)
      this.startedAt = this.now
      for (const p of this.players) if (has(this, 'chip_stack', p.uid)) { const x = Math.round((this.startChips || p.chips) * STACK_BONUS); p.chips += x; this.minted = (this.minted || 0) + x }
    }
    this.lobby = false
    ;[this.sb, this.bb] = this.blinds() // blind baru berlaku mulai hand berikutnya, tidak di tengah hand
    for (const p of this.players) Object.assign(p, { inHand: el.includes(p), folded: !el.includes(p), allIn: false, acted: false, noRaise: false, show: false, cards: [], bet: 0, total: 0, score: 0, won: 0, last: '', stack0: p.chips, skills: [], saved: 0, fined: 0, target: -1, forced: false, lucky: null, peekAt: -1, countered: false, boost: 0, pre: null, spot: -1, insured: 0, blind: false, iced: false, guarded: false, rescued: 0, back: 0, sense: null, peekCard: -1, third: -1, deathPaid: 0 })
    this.death = null
    this.handNo++
    this.deck = this.newDeck(); this.board = []; this.phase = 'preflop'; this.bet = this.bb; this.minRaise = this.bb
    this.dealer = this.after(this.dealer, p => p.inHand)
    const sb = el.length === 2 ? this.dealer : this.after(this.dealer, p => p.inHand), bb = this.after(sb, p => p.inHand)
    el.forEach(p => p.cards = [this.deck.pop(), this.deck.pop()])
    this.applyLuck(el)
    this.put(this.players[sb], this.sb); this.put(this.players[bb], this.bb)
    this.blindPost = { [sb]: this.players[sb].total, [bb]: this.players[bb].total }
    this.players[sb].last = 'sb'; this.players[bb].last = 'bb'
    if (this.madness) { // All-in Madness (host): semua yang dibagi kartu langsung all-in, kartu dibuka, board dibuka bertahap
      this.madness = false
      for (const p of el) { this.put(p, p.chips); p.last = 'all-in' }
      this.bet = Math.max(...el.map(p => p.bet))
      return this.advance()
    }
    this.step(bb)
  }
  put(p, a) { a = Math.min(a, p.chips); p.chips -= a; p.bet += a; p.total += a; if (!p.chips) p.allIn = true }

  ctl(i) {
    const p = this.players[i], call = this.bet - p.bet, max = p.bet + p.chips
    return { call: Math.min(call, p.chips), bet: this.bet, minTo: Math.min(this.bet + this.minRaise, max), maxTo: max, raise: !p.noRaise && !this.frozen(i) && p.chips > call }
  }
  // Pemain yang tidak aktif cuma diberi waktu singkat supaya turnamen tidak tertahan.
  // Speed Round (host): waktu giliran lebih singkat; Shot Clock Duel: dua pemain itu cuma SHOT_MS
  turnMs(i = this.turn) {
    const p = this.players[i], shot = this.shot?.no === this.handNo && p && this.shot.uids.includes(p.uid)
    return Math.min(shot ? SHOT_MS : TURN_MS, this.speed === this.handNo ? SPEED_MS : TURN_MS)
  }
  setTurn(i) {
    this.turn = i; const p = this.players[i]; this.defer('turn', p.sitOut || !this.online(p) ? Math.min(AWAY_MS, this.turnMs(i)) : this.turnMs(i))
    if (p.pre) this.autoAct(i)
  }
  // ---- pre-action: dipilih pemain sebelum gilirannya, disimpan di server (tetap jalan walau koneksinya putus) ----
  // fold = check/fold (check kalau gratis, fold kalau ada taruhan; batal kalau fold kena denda Go Big/Duel)
  // check = check selama tidak ada bet (mati sendiri begitu ada yang bet/raise) ; call = call berapa pun (any call)
  // Berlaku sampai hand selesai atau dimatikan pemain.
  setPre(i, v) {
    const p = this.players[i]
    if (!['', 'fold', 'check', 'call'].includes(v)) return 'Pilihan tidak dikenal'
    if (v && (!this.betting || !p.inHand || p.folded || p.allIn)) return 'Hanya selama kamu masih ikut hand'
    if (v === 'check' && this.bet > p.bet) return 'Sudah ada taruhan, Auto Check tidak bisa dipakai'
    p.pre = v || null
    if (v && this.turn === i) this.autoAct(i) // dipilih tepat saat gilirannya: langsung jalan
  }
  autoAct(i) {
    const p = this.players[i], toCall = this.bet - p.bet, pre = p.pre
    if (pre === 'call') return this.act(i, toCall ? 'call' : 'check')
    if (!toCall) return this.act(i, 'check')
    if (pre === 'fold' && !this.bigFine(i)) return this.act(i, 'fold')
    p.pre = null // auto check bertemu taruhan / fold kena denda: pemain memutuskan sendiri
  }
  timeout() {
    const p = this.players[this.turn]
    if (!p) return
    p.sitOut = true // pemain idle: auto check/fold sampai dia beraksi lagi atau menekan "Main lagi"
    this.act(this.turn, p.bet === this.bet ? 'check' : 'fold')
  }

  // Mengembalikan string error, atau undefined kalau sukses.
  act(i, type, amount) {
    if (i !== this.turn) return 'Bukan giliranmu'
    const p = this.players[i], toCall = this.bet - p.bet
    if (type === 'fold') {
      p.folded = true; p.last = 'fold'
      const pen = this.bigFine(i)
      if (pen) { p.chips -= pen; p.total += pen; p.fined = pen } // Go Big or Go Home!: denda fold masuk pot
    }
    else if (type === 'check') { if (toCall) return 'Tidak bisa check, ada bet'; p.last = 'check' }
    else if (type === 'call') { const a = Math.min(toCall, p.chips); this.put(p, a); p.last = a ? 'call ' + a : 'check' }
    else if (type === 'raise') {
      const to = Math.min(Math.floor(+amount), p.bet + p.chips)
      if (!(to > this.bet) || p.noRaise) return 'Raise tidak valid'
      if (this.frozen(i)) return '🧊 Kamu kena Freeze: tidak bisa raise di hand ini'
      const full = to - this.bet >= this.minRaise
      if (!full && to < p.bet + p.chips) return `Minimal raise ke ${this.bet + this.minRaise}`
      p.last = (this.bet ? 'raise ' : 'bet ') + to
      this.put(p, to - p.bet)
      if (full) { this.minRaise = to - this.bet; for (const q of this.players) q.acted = q.noRaise = false }
      else for (const q of this.players) { if (q.acted) q.noRaise = true; q.acted = false } // all-in pendek tidak membuka raise lagi
      this.bet = to
      for (const q of this.players) if (q !== p && q.pre === 'check') q.pre = null // ada bet/raise: Auto Check mati
    } else return 'Aksi tidak dikenal'
    p.acted = true
    this.step(i)
  }

  step(from) {
    const con = this.players.filter(p => p.inHand && !p.folded)
    if (con.length < 2) return this.finish(con)
    const live = con.filter(p => !p.allIn)
    if (live.every(p => p.acted && p.bet === this.bet) || (live.length < 2 && live.every(p => p.bet >= this.bet))) return this.advance()
    this.setTurn(this.after(from, p => p.inHand && !p.folded && !p.allIn))
  }
  advance() {
    for (const p of this.players) Object.assign(p, { bet: 0, acted: false, noRaise: false, last: p.folded ? p.last : '' }) // label aksi per ronde
    this.bet = 0; this.minRaise = this.bb
    if (this.phase === 'river') return this.showdown()
    for (let k = this.phase === 'preflop' ? 3 : 1; k--;) this.board.push(this.deck.pop()) // tanpa burn card
    this.phase = { preflop: 'flop', flop: 'turn', turn: 'river' }[this.phase]
    const con = this.players.filter(p => p.inHand && !p.folded)
    if (this.phase === 'flop') for (const p of con) { // passive Card Sense: sekali per match, tahu 1 kartu lawan saat flop
      if (!has(this, 'card_sense', p.uid) || (this.sensed || []).includes(p.uid)) continue
      const opp = con.filter(q => q !== p)
      if (!opp.length) continue
      const q = opp[R(opp.length)]
      p.sense = { j: this.players.indexOf(q), k: R(2) }
      this.sensed = [...(this.sensed || []), p.uid]
    }
    if (con.filter(p => !p.allIn).length > 1) return this.setTurn(this.after(this.dealer, p => p.inHand && !p.folded && !p.allIn))
    con.forEach(p => p.show = true) // semua all-in: buka kartu, board dibuka bertahap
    this.turn = -1; this.defer('runout', RUNOUT_MS)
  }
  showdown() {
    const con = this.players.filter(p => p.inHand && !p.folded)
    con.forEach(p => { p.show = true; p.score = best(p.cards.concat(this.board)) })
    this.finish(con)
  }
  // Bagi pot (main + side pot) ke pemenang. con = pemain yang masih bertahan.
  finish(con) {
    for (const p of this.players) if (p.folded && (p.skills || []).includes('chip_saver')) { // Chip Saver: fold = setengah taruhan kembali
      const x = Math.floor((p.total - (p.fined || 0)) / 2)
      if (x > 0) { p.total -= x; p.chips += x; p.back = x }
    }
    // taruhan yang tidak ada yang menyamai dikembalikan dulu (bukan "kemenangan")
    const [a, b] = [...this.players].sort((x, y) => y.total - x.total)
    if (b && a.total > b.total && a.inHand && !a.folded) { const r = a.total - b.total; a.chips += r; a.total -= r }
    for (const p of this.players) p.paid = p.total // chip yang benar-benar dipertaruhkan pemain (untuk Defend Me & Insurance)
    // Double Payout / Jackpot (host): chip bonus ditambahkan ke kontribusi tiap pemain, jadi ikut dibagi per (side) pot
    for (const p of this.players) if (p.boost) p.total += p.boost
    if (this.don === this.handNo) { // Double or Nothing (host): pot dobel atau tinggal setengah (separuhnya hangus)
      const win = R(2) === 1, pot = this.players.reduce((s, p) => s + p.total, 0)
      for (const p of this.players) p.total = win ? p.total * 2 : Math.floor(p.total / 2)
      const now = this.players.reduce((s, p) => s + p.total, 0)
      if (win) this.minted = (this.minted || 0) + now - pot; else this.forfeited = (this.forfeited || 0) + pot - now
      this.donResult = { no: this.handNo, win, pot: now }
    }
    const n = this.players.length, all = this.players.filter(p => p.total > 0)
    const levels = [...new Set(con.map(p => p.total))].sort((x, y) => x - y), seat = p => (this.players.indexOf(p) - this.dealer - 1 + n) % n
    let prev = 0
    const scored = con.length > 1 && con.every(p => p.score)
    if (this.split === this.handNo && scored) { // Split Pot (host): pot dibagi rata ke 2 kombinasi terbaik, tanpa side pot
      const pot = all.reduce((s, p) => s + p.total, 0), top = [...con].sort((x, y) => y.score - x.score || seat(x) - seat(y)).slice(0, 2)
      top.forEach((p, j) => { const g = Math.floor(pot / 2) + (j === 0 ? pot % 2 : 0); p.chips += g; p.won += g })
      levels.length = 0
    }
    levels.forEach((L, k) => {
      const cap = k === levels.length - 1 ? Infinity : L // level terakhir menyerap sisa kontribusi pemain fold
      const pot = all.reduce((s, p) => s + Math.min(p.total, cap) - Math.min(p.total, prev), 0)
      const el = con.filter(p => p.total >= L), top = Math.max(...el.map(p => p.score))
      const ws = el.filter(p => p.score === top).sort((x, y) => seat(x) - seat(y)), share = Math.floor(pot / ws.length), rem = pot - share * ws.length
      ws.forEach((p, j) => { const g = share + (j < rem ? 1 : 0); p.chips += g; p.won += g }) // sisa chip ganjil ke pemenang pertama sesudah dealer
      prev = L
    })
    this.defend()
    if (this.insure === this.handNo) for (const p of this.players) { // Insurance (host): yang kalah all-in dapat kembali 25%
      const lost = p.paid - p.won
      if (p.inHand && p.allIn && lost > 0) { const x = Math.floor(lost * INSURE_SHARE); p.chips += x; p.insured = x; this.minted = (this.minted || 0) + x }
    }
    this.hotSeat()
    this.deathHit(con)
    for (const p of this.players) { // Second Chance (diri sendiri) & Guardian Angel (dari pemain lain): batal tersingkir
      if (p.chips > 0 || p.place || !p.inHand) continue
      const x = p.guarded ? Math.max(this.bb, Math.floor(p.stack0 * GUARD_SHARE)) : (p.skills || []).includes('second_chance') ? this.bb : 0
      if (x) { p.chips = x; p.rescued = x; p.allIn = false; this.minted = (this.minted || 0) + x }
    }
    for (const p of this.players) { p.bet = 0; if (!p.folded) p.last = '' }
    this.phase = 'showdown'; this.turn = -1; this.hands++
    // hitung hand AFK: masih istirahat di akhir hand = AFK; beraksi atau menekan "Main lagi" = mulai dari 0
    for (const p of this.players) if (p.inHand && !p.place) p.afk = p.sitOut ? (p.afk || 0) + 1 : 0
    this.eliminate()
    if (this.donResult?.no === this.handNo) this.announce(-1, 'don_result', -1, (this.donResult.win ? 'win:' : 'lose:') + this.donResult.pot)
    if (this.hotPaid?.no === this.handNo && this.hotPaid.chips) this.announce(this.hotPaid.i, 'hot_seat_hit', this.hotPaid.i, String(this.hotPaid.chips))
    const dh = this.players.findIndex(p => p.deathPaid)
    if (dh >= 0) this.announce(dh, 'death_hit', this.deathTo ?? -1, String(this.players[dh].deathPaid))
    const rs = this.players.findIndex(p => p.rescued && !p.place)
    if (rs >= 0) this.announce(rs, this.players[rs].guarded ? 'guardian_hit' : 'second_chance_hit', rs, String(this.players[rs].rescued))
    this.payBounty()
    if (this.alive().length < 2) { this.lastShow = this.handNo; return this.end() } // showdown terakhir tetap diputar di layar
    this.defer('next', Math.max(NEXT_MS, REVEAL_LEAD_MS + this.showdownOrder().length * REVEAL_MS + 2500))
  }
  // Pemain yang chip-nya habis di hand ini tersingkir. Kalau beberapa sekaligus, yang stack awal hand-nya lebih
  // besar dapat peringkat lebih baik (tersingkir "belakangan"); seri = urutan kursi.
  // Pemain AFK AFK_HANDS hand berturut-turut juga tersingkir (chip-nya hangus) dan mendapat peringkat lebih buruk dari
  // yang bust di hand yang sama. Kalau semua yang tersisa AFK, yang chip-nya paling banyak tetap bertahan sebagai juara.
  eliminate() {
    const seat = p => this.players.indexOf(p)
    const alive = this.alive(), afk = alive.filter(p => p.afk >= AFK_HANDS)
    if (afk.length && afk.length === alive.length) afk.splice(afk.indexOf([...afk].sort((x, y) => y.chips - x.chips || seat(x) - seat(y))[0]), 1)
    for (const p of afk) { this.forfeited = (this.forfeited || 0) + p.chips; p.chips = 0; p.afkOut = true } // meja lama belum punya forfeited
    const busted = this.players.filter(p => !p.chips && !p.place)
      .sort((x, y) => y.afkOut - x.afkOut || x.stack0 - y.stack0 || seat(x) - seat(y))
    for (const p of busted) {
      p.place = this.players.length - this.out.length
      this.out.push(p.uid)
    }
  }
  end() {
    const left = this.alive()
    if (left.length === 1) { left[0].place = 1; this.winner = left[0].uid }
    this.phase = 'over'; this.turn = -1; this.due = null
  }

  // ---- lobi: Ready / Out sebelum hand pertama ----
  counting() { return !!this.lobby && this.due?.kind === 'start' }
  setReady(i, on) {
    const p = this.players[i]
    if (!this.lobby || !p) return 'Match sudah berjalan'
    if (this.counting()) return 'Hitung mundur sudah berjalan'
    p.ready = !!on
    this.checkReady()
  }
  // Semua pemain Ready (minimal 2): mulai hitung mundur.
  checkReady() {
    if (this.lobby && !this.counting() && this.players.length >= 2 && this.players.every(p => p.ready)) this.defer('start', COUNTDOWN_MS)
  }
  canWithdraw(i) {
    if (!this.lobby || !this.players[i]) return 'Match sudah berjalan, tidak bisa keluar lagi'
    if (this.counting()) return 'Hitung mundur sudah berjalan'
    if (this.players.length <= 2) return 'Minimal 2 pemain. Minta host membatalkan match kalau tidak jadi main.'
  }
  // Pemain keluar dari match sebelum hand pertama: kursinya dihapus dari meja.
  // force: sudah tercatat keluar di database (request lain mungkin baru saja memulai hitung mundur), tetap hapus
  // kursinya selama hand pertama belum dibagi.
  withdraw(i, force = false) {
    const err = force ? (!this.lobby || !this.players[i] ? 'Match sudah berjalan, tidak bisa keluar lagi' : '') : this.canWithdraw(i)
    if (err) return err
    this.players.splice(i, 1)
    this.checkReady()
  }

  /** Denda fold pemain i kalau Go Big or Go Home! aktif di hand ini (0 = tidak kena). */
  // Duel Me! juga: lawan yang diajak duel (duelFine) kena denda yang sama kalau fold.
  bigFine(i) {
    const p = this.players[i]
    const hit = (this.big >= 0 && this.big !== i) || (this.duelFine >= 0 && this.duelFine === i)
    return hit && this.betting && p?.inHand ? Math.floor(p.chips * BIG_SHARE) : 0
  }

  sitIn(i) { this.players[i].sitOut = false; this.players[i].afk = 0 }

  // ---- skill card di meja ----
  // Satu kartu per pemain per hand, hanya selama hand berjalan dan pemain belum fold.
  // Kartu Attack butuh target j: lawan yang masih ikut hand. Fold Player hanya sebelum flop dan tidak ke pemain all-in.
  canUseCard(i, code, j) {
    const p = this.players[i], sk = SKILLS[code]
    if (!sk) return 'Kartu ini tidak bisa dipakai di meja'
    if (this.silenced()) return '🤐 Silence dari host: skill card dikunci di hand ini'
    if (sk.angel) {
      if (this.phase === 'over' || !p) return 'Match sudah selesai'
      if (this.lobby || !this.handNo) return 'Revive baru bisa dipakai setelah ada pemain yang tersingkir'
      if (this.alive().length <= 2) return 'Revive tidak bisa dipakai kalau pemain tersisa tinggal 2'
      if (this.revive) return 'Sudah ada pemain yang menunggu dihidupkan, tunggu hand berikutnya'
      const q = this.players[j]
      if (!Number.isInteger(j) || !q) return 'Pilih pemain yang mau dihidupkan'
      if (!q.place || q.chips > 0) return `${q.name} masih bertahan`
      return
    }
    if (sk.wild) {
      if (this.phase === 'over' || !p || p.place || !p.chips) return 'Kamu sudah tidak ikut turnamen ini'
      if (this.lobby || !this.handNo) return 'Wildcard baru bisa dipakai setelah match berjalan'
      if (this.alive().length <= 2) return 'Wildcard tidak bisa dipakai kalau pemain tinggal 2'
      if (this.wild) return this.wild.i === i ? 'Wildcard kamu sudah menunggu hand ini selesai' : 'Sudah ada wildcard lain yang menunggu, tunggu sampai selesai'
      const q = this.players[j]
      if (!Number.isInteger(j) || !q || j === i) return 'Pilih pemain yang mau ditarget'
      if (q.place || !q.chips) return `${q.name} sudah tersingkir`
      return
    }
    if (sk.luck) { // dipasang untuk hand berikutnya, satu kartu Luck saja untuk seluruh meja
      if (this.phase === 'over' || !p || p.place || !p.chips) return 'Kamu sudah tidak ikut turnamen ini'
      if (this.luck) return this.luck.i === i ? 'Kartu Luck kamu sudah menunggu hand berikutnya' : 'Sudah ada pemain lain yang memasang kartu Luck untuk hand berikutnya'
      return
    }
    if (sk.ransom) {
      if (this.phase === 'over' || !p || p.place || !p.chips) return 'Kamu sudah tidak ikut turnamen ini'
      if (this.lobby || !this.handNo) return "King's Ransom baru bisa dipakai setelah match berjalan"
      if (this.ransom) return "Sudah ada King's Ransom yang menunggu hand berikutnya"
      return
    }
    if (sk.share) {
      if (!this.luck || this.luck.i !== i) return 'Pasang kartu Luck dulu, baru bisa dibagi'
      if (this.luck.also >= 0) return 'Kartu Luck kamu sudah dibagi'
      const q = this.players[j]
      if (!Number.isInteger(j) || !q || j === i) return 'Pilih pemain yang mau diberi keberuntungan'
      if (q.place || !q.chips) return `${q.name} sudah tersingkir`
      return
    }
    if (!this.betting) return 'Skill card hanya bisa dipakai selama hand berjalan'
    if (!p || !p.inHand || p.folded) return 'Kamu sudah tidak ikut hand ini'
    if ((p.skills || []).length) return 'Maksimal 1 skill card per hand'
    if (code === 'duel_me') {
      if (this.board.length >= 4) return 'Duel Me! hanya bisa dipakai sebelum kartu ke-4 (turn) dibuka'
      if (this.alive().length <= 2) return 'Duel Me! tidak bisa dipakai kalau pemain tinggal 2'
      if (this.players.filter(q => q.inHand && !q.folded).length <= 2) return 'Hand ini sudah tinggal kalian berdua'
    }
    if (sk.big) {
      if (this.alive().length <= 2) return 'Wildcard tidak bisa dipakai kalau pemain tinggal 2'
      if (this.big >= 0) return 'Go Big or Go Home! sudah aktif di hand ini'
      if (this.players.filter(q => q !== p && q.inHand && !q.folded).length < 1) return 'Tidak ada lawan di hand ini'
    }
    if (code === 'board_peek' && this.board.length >= 5) return 'Semua kartu meja sudah terbuka'
    if (code === 'death_card') {
      if (this.phase !== 'preflop') return 'Death Card hanya bisa dipakai sebelum flop'
      if (this.players.filter(q => q.inHand && !q.folded).length < 2) return 'Tidak ada lawan di hand ini'
    }
    if (code === 'chaos_shuffle' && this.players.filter(q => q.inHand && !q.folded).length < 2) return 'Tidak ada lawan di hand ini'
    if (code === 'tax_collector') {
      const q = this.richest(i)
      if (!q || Math.floor(q.chips * TAX_COLLECT) < 1) return 'Tidak ada chip lawan yang bisa dipajaki'
    }
    if (!sk.target) return
    const q = this.players[j]
    if (!Number.isInteger(j) || !q || j === i) return 'Pilih lawan yang mau ditarget'
    if (!q.inHand || q.folded) return `${q.name} sudah tidak ikut hand ini`
    if (code === 'fold_player') {
      if (this.phase !== 'preflop') return 'Fold Player hanya bisa dipakai sebelum flop'
      if (q.allIn) return `${q.name} sudah all-in, tidak bisa dipaksa fold`
    }
    if (code === 'blindfold' && this.phase !== 'preflop') return 'Blindfold hanya bisa dipakai sebelum flop'
    if (code === 'blind_steal') {
      if (this.phase !== 'preflop') return 'Blind Steal hanya bisa dipakai sebelum flop'
      if (!this.blindPost?.[j]) return `${q.name} tidak memasang blind di hand ini`
      if (q.chips < 2) return `Chip ${q.name} sudah habis`
    }
    if (code === 'freeze_player' && q.iced) return `${q.name} sudah dibekukan`
  }
  richest(i) { return this.players.filter((q, k) => k !== i && q.chips > 0 && !q.place).sort((x, y) => y.chips - x.chips)[0] }
  useCard(i, code, j, card = null) {
    const err = this.canUseCard(i, code, j)
    if (err) return err
    const p = this.players[i]
    if (SKILLS[code].luck) { this.luck = { i, code }; return }
    if (SKILLS[code].angel) {
      this.revive = { by: p.uid, target: this.players[j].uid, card }
      this.announce(i, code, j, String(this.startChipsOf()))
      if (!this.betting && this.due?.kind === 'next') this.defer('next', Math.max(this.due.at - this.now, WILD_MS)) // beri waktu pengumumannya
      return
    }
    if (SKILLS[code].ransom) { this.ransom = { by: p.uid }; this.announce(i, code, -1, String(this.bb)); return }
    if (SKILLS[code].share) { this.luck.also = j; this.luck.alsoCard = card; this.announce(i, code, j); return }
    if (SKILLS[code].wild) {
      this.wild = { by: p.uid, target: this.players[j].uid, code, card, shown: false }
      if (!this.betting) this.defer('next', Math.max(0, Math.min(this.due ? this.due.at - this.now : 0, 1500))) // di antara hand: segera
      return
    }
    p.skills = [...(p.skills || []), code]
    if (COUNTERED.includes(code) && this.hasCounter(j)) return this.counterHit(i, code, j)
    if (code === 'tax_collector') j = this.players.indexOf(this.richest(i))
    if (ATTACKS.includes(code) && (this.players[j]?.skills || []).includes('shield')) { // Shield: serangan ditahan, kartu penyerang hangus
      this.announce(i, code, code === 'reveal_card' ? -1 : j, 'shield')
      return
    }
    if (SKILLS[code].target) p.target = j
    if (SKILLS[code].open) this.announce(i, code, SKILLS[code].secret ? -1 : j) // kartu Attack langsung diumumkan di tengah meja
    if (code === 'go_big') this.big = i
    if (code === 'card_reroll') { // kartu lama dibuang; kartu baru diambil dari dasar dek supaya urutan kartu meja tetap
      p.cards = [this.deck.shift(), this.deck.shift()]
      this.rr = (this.rr || 0) + 1
    }
    if (code === 'fold_player') this.forceFold(j)
    if (code === 'duel_me') this.duelNow(i, j)
    if (code === 'blindfold') this.players[j].blind = true
    if (code === 'freeze_player') this.players[j].iced = true
    if (code === 'guardian_angel') this.players[j].guarded = true
    if (code === 'blind_steal' || code === 'tax_collector') {
      const q = this.players[j], x = code === 'tax_collector' ? Math.floor(q.chips * TAX_COLLECT) : Math.min(this.blindPost[j], q.chips - 1)
      q.chips -= x; p.chips += x; p.allIn = p.allIn && !p.chips
      this.ann.extra = String(x)
    }
    if (code === 'board_peek') { p.peekCard = this.deck[this.deck.length - 1]; p.peekLen = this.board.length }
    if (code === 'chaos_shuffle') { // semua kartu tangan pemain yang masih ikut dikocok lalu dibagi ulang
      const con = this.players.filter(q => q.inHand && !q.folded), pile = shuffle(con.flatMap(q => q.cards))
      con.forEach((q, k) => q.cards = pile.slice(k * 2, k * 2 + 2))
      this.rr = (this.rr || 0) + 1
    }
    if (code === 'death_card') { // kartu kematian dipilih dari kartu tangan yang sedang dipegang
      const pile = this.players.filter(q => q.inHand && !q.folded).flatMap(q => q.cards)
      this.death = { no: this.handNo, card: pile[R(pile.length)] }
      this.ann.extra = String(this.death.card)
    }
  }
  hasCounter(j) { const q = this.players[j]; return !!q && (this.counter || []).includes(q.uid) }
  // Full Counter: serangan i ke j berbalik ke i. Pengumumannya hanya menyebut penyerang (target dirahasiakan).
  // Fold Player: penyerang yang dipaksa fold. Reveal Card: target yang melihat kartu penyerang sampai hand selesai.
  counterHit(i, code, j) {
    const p = this.players[i], q = this.players[j]
    p.countered = true
    this.counters = (this.counters || 0) + 1
    this.announce(i, code, -1, 'counter')
    if (code === 'reveal_card') q.peekAt = i
    if (code === 'fold_player') this.forceFold(i)
  }
  // Duel Me!: semua pemain selain i dan j dipaksa fold sekaligus, lalu permainan lanjut seperti forceFold.
  duelNow(i, j) {
    const out = this.players.filter((q, k) => k !== i && k !== j && q.inHand && !q.folded)
    for (const q of out) { q.folded = true; q.forced = true; q.last = 'fold' }
    this.duel = [i, j]
    this.duelFine = j
    if (out.includes(this.players[this.turn])) return this.step(this.turn)
    const live = [this.players[i], this.players[j]].filter(p => !p.allIn)
    if (live.every(p => p.acted && p.bet === this.bet) || (live.length < 2 && live.every(p => p.bet >= this.bet))) this.advance()
  }
  /** Chip awal match (meja lama tidak menyimpannya: chip di meja + yang hangus dibagi jumlah pemain). */
  startChipsOf() {
    if (!this.startChips) { // selama hand berjalan sebagian chip ada di pot (p.total)
      const onTable = this.players.reduce((s, p) => s + p.chips + (this.betting ? p.total : 0), 0)
      this.startChips = Math.round((onTable + (this.forfeited || 0) - (this.minted || 0)) / this.players.length)
    }
    return this.startChips
  }
  // Revive yang menunggu: pemain itu kembali dengan chip awal sebelum hand berikutnya dibagi. Peringkat pemain yang
  // tersingkir sesudahnya disusun ulang dari urutan `out`. Batal (kartu dikembalikan) kalau pemain tersisa tinggal 2.
  applyRevive() {
    const r = this.revive
    if (!r) return
    this.revive = null
    const q = this.players.find(p => p.uid === r.target)
    if (!q || !q.place || q.chips > 0 || this.alive().length <= 2) {
      if (r.card) this.refunds = [...(this.refunds || []), { uid: r.by, card: r.card }]
      return
    }
    const n = this.players.length, chips = this.startChipsOf()
    this.out = this.out.filter(u => u !== q.uid)
    this.out.forEach((u, k) => { const x = this.players.find(p => p.uid === u); if (x) x.place = n - k })
    Object.assign(q, { chips, place: 0, killed: false, afkOut: false, afk: 0, sitOut: false, revived: (q.revived || 0) + 1 })
    this.minted = (this.minted || 0) + chips
  }
  // Pengumuman di tengah meja: siapa memakai kartu apa ke siapa (extra = keterangan hasil).
  announce(i, code, j, extra = '') {
    this.annN = (this.annN || 0) + 1
    this.ann = { n: this.annN, at: this.now, by: i, code, target: j, extra }
    // kartu yang diumumkan di tengah hand menyela permainan: waktu pemain yang sedang giliran diulang dari awal
    if (this.betting && this.turn >= 0) this.setTurn(this.turn)
  }
  // Wildcard yang menunggu: tahap 1 = umumkan dan beri jeda; tahap 2 = jalankan efeknya lalu hand dibagi seperti biasa.
  // Mengembalikan true kalau hand belum boleh dibagi sekarang.
  wildStage() {
    const w = this.wild, by = this.players.findIndex(p => p.uid === w.by), tg = this.players.findIndex(p => p.uid === w.target)
    const P = this.players[by], Q = this.players[tg], alive = this.alive()
    if (!P || !Q || !P.chips || P.place || !Q.chips || Q.place || alive.length <= 2) { // batal: kartu dikembalikan
      this.wild = null
      if (w.card) this.refunds = [...(this.refunds || []), { uid: w.by, card: w.card }]
      return false
    }
    if (!w.shown) {
      w.shown = true
      this.announce(by, w.code, tg, w.code === 'you_owe_me' ? String(Math.floor(Q.chips * OWE_SHARE)) : '')
      this.defer('next', WILD_MS)
      return true
    }
    this.wild = null
    this.wildUsed = [...(this.wildUsed || []), { uid: w.by, code: w.code, target: w.target }]
    if (w.code === 'you_owe_me') { const a = Math.floor(Q.chips * OWE_SHARE); Q.chips -= a; P.chips += a }
    else if (w.code === 'duel_me') this.duelNext = [w.by, w.target]
    else if (w.code === 'get_out') { // langsung tersingkir; chip-nya hangus, peringkat di bawah semua yang masih bertahan
      this.forfeited = (this.forfeited || 0) + Q.chips; Q.chips = 0; Q.killed = true
      Q.place = this.players.length - this.out.length; this.out.push(Q.uid)
    }
    return false
  }
  // Kartu Luck yang menunggu dipakai saat hand dibagi. Kalau pemiliknya sudah tersingkir, kartunya hangus.
  // lucky (hanya terlihat pemiliknya) = berhasil atau tidak.
  applyLuck(el) {
    const L = this.luck
    this.luck = null
    const o = L && this.players[L.i]
    if (o && !el.includes(o) && o.chips > 0 && !o.place) { this.luck = L; return } // tidak ikut hand ini (duel): tunggu
    if (!o || !el.includes(o)) return
    o.skills = [L.code]
    o.lucky = false
    const partner = L.also >= 0 ? this.players[L.also] : null
    try {
      if (R(100) >= Math.min(100, SKILLS[L.code].chance + (has(this, 'lucky_charm', o.uid) ? CHARM_BONUS : 0))) return
      this.rigFor(o, L.code, el)
    } finally { if (partner && el.includes(partner) && partner !== o) { partner.skills = ['share_luck']; this.gift(partner, SKILLS[L.code].luck) } }
  }
  // Share the Luck: pasangan mendapat tangan sejenis (pair/suited) dari sisa dek; kartu Luck kombinasi meja = pocket pair.
  gift(q, luck) {
    const pool = this.deck.slice(0, Math.max(0, this.deck.length - 5)) // 5 kartu terakhir disisakan untuk kartu meja
    const pick = luck.suited ? (() => { for (const a of shuffle(pool.slice())) { const b = pool.find(c => c !== a && ((c / 13) | 0) === ((a / 13) | 0)); if (b !== undefined) return [a, b] } })()
      : (() => { for (const a of shuffle(pool.slice())) { const b = pool.find(c => c !== a && c % 13 === a % 13); if (b !== undefined) return [a, b] } })()
    if (!pick) return
    this.deck = this.deck.filter(c => !pick.includes(c)); this.deck.unshift(...q.cards); q.cards = pick; q.lucky = true
  }
  rigFor(o, code, el) {
    const L = { code }
    if (SKILLS[L.code].luck.third) { // Third Card: dapat 3 kartu, otomatis disimpan 2 terbaik
      const three = [...o.cards, this.deck.pop()], pairs = [[0, 1], [0, 2], [1, 2]]
      const [x, y] = pairs.sort((u, v) => holeScore(three[v[0]], three[v[1]]) - holeScore(three[u[0]], three[u[1]]))[0]
      o.third = three.find((_, k) => k !== x && k !== y); o.cards = [three[x], three[y]]; o.lucky = true
      return
    }
    if (SKILLS[L.code].luck.pair || SKILLS[L.code].luck.suited) { // pocket pair / suited: pemain lain dan kartu meja dari sisa dek yang diacak ulang
      const suit = R(4), [r1, r2] = shuffle([...Array(13)].map((_, k) => k + 2)), rank = 2 + R(13), [a, b] = shuffle([0, 1, 2, 3])
      const hole = SKILLS[L.code].luck.suited ? [card(r1, suit), card(r2, suit)] : [card(rank, a), card(rank, b)]
      this.deck = this.newDeck().filter(c => !hole.includes(c))
      for (const p of el) p.cards = p === o ? hole : [this.deck.pop(), this.deck.pop()]
      o.lucky = true
      return
    }
    const r = rigLuck(SKILLS[L.code].luck)
    if (!r) return
    // bagi ulang: pemilik mendapat kartu susunan, pemain lain dari sisa dek, lalu kartu meja ditaruh di ujung dek
    const used = new Set(r.hole.concat(r.board))
    this.deck = this.newDeck().filter(c => !used.has(c))
    for (const p of el) p.cards = p === o ? r.hole : [this.deck.pop(), this.deck.pop()]
    this.deck.push(...r.board.slice().reverse()) // pop() berikutnya = board[0], board[1], ...
    o.lucky = true
  }
  // King's Ransom: sebelum hand berikutnya dibagi, tiap lawan yang masih bertahan bayar 1 big blind ke pemakainya
  // (tidak sampai membuat lawan tersingkir).
  applyRansom() {
    const r = this.ransom
    if (!r) return
    this.ransom = null
    const P = this.players.find(p => p.uid === r.by)
    if (!P || !P.chips || P.place) return
    const [, bb] = this.blinds()
    let got = 0
    for (const q of this.players) if (q !== P && q.chips > 1 && !q.place) { const x = Math.min(bb, q.chips - 1); q.chips -= x; got += x }
    P.chips += got
    this.announce(this.players.indexOf(P), 'ransom_paid', -1, String(got))
  }
  // Death Card: pemegang kartu kematian yang bertahan sampai showdown kehilangan 65% chip (dari stack awal hand)
  // ke kombinasi terbaik pemain lain di showdown itu.
  deathHit(con) {
    const d = this.death
    this.deathTo = -1
    if (!d || d.no !== this.handNo || con.length < 2 || !con.every(p => p.score)) return
    const P = con.find(p => p.cards.includes(d.card))
    if (!P) return
    const to = con.filter(p => p !== P).sort((x, y) => y.score - x.score)[0], x = Math.min(Math.floor(P.stack0 * DEATH_SHARE), P.chips)
    if (!to || x <= 0) return
    P.chips -= x; P.deathPaid = x; to.chips += x; to.won += x
    this.deathTo = this.players.indexOf(to)
  }
  // ---- skill card host ----
  silenced() { return this.betting && this.silence === this.handNo }
  // Hand yang kena efek "hand ini / hand berikutnya": selama hand berjalan = hand ini, di antara hand = hand berikutnya.
  nextNo() { return this.betting ? this.handNo : this.handNo + 1 }
  canHost(code, j, k2) {
    const h = HOST_SKILLS[code]
    if (!h) return 'Skill host tidak dikenal'
    if (this.phase === 'over') return 'Match sudah selesai'
    if (this.lobby || !this.handNo) return 'Skill host baru bisa dipakai setelah hand pertama dibagi'
    if (this.hostUsed === this.handNo) return 'Maksimal 1 skill host per hand, tunggu hand berikutnya'
    if (h.now && !this.betting) return 'Hanya bisa dipakai selama hand berjalan'
    const con = this.players.filter(p => p.inHand && !p.folded)
    if (h.now && con.length < 2) return 'Hand ini sudah selesai'
    if (code === 'board_reroll' && this.board.length < 3) return 'Board Reroll baru bisa dipakai setelah flop dibuka'
    if (code === 'board_reroll' && con.every(p => p.allIn) && this.turn < 0) return 'Kartu meja sedang dibuka otomatis'
    if (code === 'open_hand' && con.every(p => p.show)) return 'Kartu semua pemain sudah terbuka'
    if (code === 'all_in_madness' && this.madness) return 'All-in Madness sudah menunggu hand berikutnya'
    if (code === 'blind_up' && this.level() >= LEVELS.length - 1) return 'Blind sudah di level tertinggi'
    if (code === 'lucky_spin' && this.luck) return 'Sudah ada kartu Luck yang menunggu hand berikutnya'
    if (code === 'charity' && this.alive().length < 2) return 'Pemain tinggal 1'
    if (code === 'final_table' && (this.finalTable || this.alive().length > 3)) return this.finalTable ? 'Final Table sudah aktif' : 'Final Table baru bisa saat pemain tinggal 3'
    if (code === 'seat_shuffle' && this.shuffleNext) return 'Kursi sudah akan diacak di hand berikutnya'
    if (code === 'double_or_nothing' && this.don === this.handNo) return 'Sudah aktif di hand ini'
    if (code === 'leader_tax') { const al = this.alive(); if (al.length < 2 || !Math.max(...al.map(p => Math.floor(p.chips * TAX_SHARE)))) return 'Tidak ada chip untuk dipajaki' }
    if (h.target) {
      const q = this.players[j]
      if (!Number.isInteger(j) || !q) return 'Pilih pemain'
      if (q.place || !q.chips && !(h.target === 'hand' && this.betting && q.inHand)) return `${q.name} sudah tersingkir`
      if (h.target === 'hand' && this.betting && (!q.inHand || q.folded)) return `${q.name} sudah tidak ikut hand ini`
      if (code === 'spotlight' && (q.show || q.spot >= 0)) return `Kartu ${q.name} sudah terbuka`
      if (code === 'bounty' && this.alive().length <= 2) return 'Bounty tidak bisa dipasang kalau pemain tinggal 2'
      if (h.target === 'two') {
        const r = this.players[k2]
        if (!Number.isInteger(k2) || !r || k2 === j) return 'Pilih dua pemain yang berbeda'
        if (r.place || !r.chips && !(this.betting && r.inHand)) return `${r.name} sudah tersingkir`
      }
    }
  }
  useHost(code, j, k2) {
    const err = this.canHost(code, j, k2)
    if (err) return err
    this.hostUsed = this.handNo
    let extra = ''
    if (code === 'double_payout' || code === 'jackpot') {
      const con = this.players.filter(p => p.inHand && !p.folded)
      if (code === 'double_payout') { // pot sekarang x2: tiap kontribusi digandakan
        let add = 0
        for (const p of this.players) if (p.total) { const x = p.total + (p.boost || 0); p.boost = (p.boost || 0) + x; add += x }
        extra = String(this.players.reduce((s, p) => s + p.total + (p.boost || 0), 0))
        this.minted = (this.minted || 0) + add
      } else { // jackpot: bonus dibagi rata ke pemain yang masih bertahan (masuk pot utama mereka)
        const bonus = JACKPOT_BB * this.bb, each = Math.floor(bonus / con.length)
        con.forEach((p, k) => p.boost = (p.boost || 0) + each + (k < bonus - each * con.length ? 1 : 0))
        this.minted = (this.minted || 0) + bonus
        extra = String(bonus)
      }
    } else if (code === 'blind_up') {
      this.levelUp = (this.levelUp || 0) + 1
      extra = this.blinds().join('/')
    } else if (code === 'speed_round') {
      this.speed = this.nextNo(); extra = this.betting ? 'now' : 'next'
    } else if (code === 'silence') {
      this.silence = this.nextNo(); extra = this.betting ? 'now' : 'next'
    } else if (code === 'all_in_madness') this.madness = true
    else if (code === 'open_hand') { for (const p of this.players) if (p.inHand && !p.folded) p.show = true }
    else if (code === 'board_reroll') { this.board = this.board.map(() => this.deck.pop()); this.rr = (this.rr || 0) + 1 }
    else if (code === 'bounty') {
      const chips = Math.round(this.startChipsOf() * BOUNTY_SHARE)
      this.bounty = { uid: this.players[j].uid, chips }
      extra = String(chips)
    } else if (code === 'charity') {
      const alive = this.alive(), low = Math.min(...alive.map(p => p.chips)), q = alive.find(p => p.chips === low)
      const chips = Math.round(this.startChipsOf() * CHARITY_SHARE)
      q.chips += chips; this.minted = (this.minted || 0) + chips
      j = this.players.indexOf(q); extra = String(chips)
    } else if (code === 'seat_shuffle') this.shuffleNext = true
    else if (code === 'double_or_nothing') this.don = this.handNo
    else if (code === 'insurance') this.insure = this.handNo
    else if (code === 'split_pot') this.split = this.handNo
    else if (code === 'final_table') this.finalTable = true
    else if (code === 'spotlight') this.players[j].spot = R(2)
    else if (code === 'freeze') { this.freeze = { uid: this.players[j].uid, no: this.nextNo() }; extra = this.betting ? 'now' : 'next' }
    else if (code === 'hot_seat') { this.hot = { uid: this.players[j].uid, no: this.nextNo() }; extra = this.betting ? 'now' : 'next' }
    else if (code === 'shot_clock') {
      this.shot = { uids: [this.players[j].uid, this.players[k2].uid], no: this.nextNo() }
      extra = k2 + ':' + (this.betting ? 'now' : 'next')
      if (this.betting && [j, k2].includes(this.turn)) this.setTurn(this.turn)
    } else if (code === 'leader_tax') { // pemimpin chip bayar 10% chip-nya, dibagi rata ke pemain lain yang masih bertahan
      const al = this.alive(), q = [...al].sort((x, y) => y.chips - x.chips)[0], others = al.filter(p => p !== q)
      const tax = Math.floor(q.chips * TAX_SHARE), each = Math.floor(tax / others.length), paid = each * others.length
      q.chips -= paid; others.forEach(p => p.chips += each)
      j = this.players.indexOf(q); extra = String(paid)
    } else if (code === 'mystery_box') { // pemain acak dapat skill card gratis ke inventory (dicatat server lewat t.gifts)
      const al = this.alive(), q = al[R(al.length)], card = BOX_CARDS[R(BOX_CARDS.length)]
      j = this.players.indexOf(q); extra = card
      this.gifts = [...(this.gifts || []), { uid: q.uid, code: card }]
    } else if (code === 'lucky_spin') {
      const alive = this.alive(), q = alive[R(alive.length)], lucks = Object.keys(SKILLS).filter(c => SKILLS[c].luck)
      j = this.players.indexOf(q)
      this.luck = { i: j, code: lucks[R(lucks.length)] }
    }
    this.announce(-1, code, Number.isInteger(j) ? j : -1, extra)
    if (!this.betting && this.due?.kind === 'next') this.defer('next', Math.max(this.due.at - this.now, 4500)) // beri waktu pengumumannya
  }
  frozen(i) { const p = this.players[i]; return !!p && (p.iced || (this.freeze?.no === this.handNo && this.freeze.uid === p.uid)) }
  // Seat Shuffle: urutan kursi diacak sebelum hand dibagi; indeks yang tersimpan ikut dipetakan ulang.
  shuffleSeats() {
    this.shuffleNext = false
    const old = this.players.slice(), next = shuffle(old.slice()), map = old.map(p => next.indexOf(p))
    this.players = next
    if (this.luck) this.luck.i = map[this.luck.i]
    if (this.duel) this.duel = this.duel.map(k => map[k])
    if (this.ann) { if (this.ann.by >= 0) this.ann.by = map[this.ann.by]; if (this.ann.target >= 0) this.ann.target = map[this.ann.target] }
    this.dealer = R(next.length) - 1 // dealer berikutnya acak juga
  }
  // Hot Seat: pemain yang ditandai menang chip di hand ini -> tiap pemain lain yang masih bertahan bayar dia 1 big blind.
  hotSeat() {
    const h = this.hot
    if (!h || h.no > this.handNo) return
    this.hot = null
    if (h.no < this.handNo) return // tidak ikut hand yang ditandai: hangus
    const q = this.players.find(p => p.uid === h.uid)
    if (!q || !(q.won > 0)) return
    let got = 0
    for (const p of this.players) if (p !== q && p.chips > 0 && !p.place) { const x = Math.min(this.bb, p.chips); p.chips -= x; got += x }
    q.chips += got
    this.hotPaid = { no: this.handNo, i: this.players.indexOf(q), chips: got }
  }
  // Bounty: pemain yang ditandai tersingkir di hand ini -> pemenang chip terbanyak hand ini mendapat hadiahnya.
  payBounty() {
    const b = this.bounty
    if (!b) return
    const q = this.players.find(p => p.uid === b.uid)
    if (!q) { this.bounty = null; return }
    if (q.chips > 0 && !q.place) return
    this.bounty = null
    const hunter = this.players.filter(p => p !== q && p.won > 0 && p.chips > 0).sort((x, y) => y.won - x.won)[0]
    if (!hunter) return
    hunter.chips += b.chips; this.minted = (this.minted || 0) + b.chips
    this.announce(this.players.indexOf(hunter), 'bounty_claim', this.players.indexOf(q), String(b.chips))
  }
  // Fold di luar giliran. Kalau korbannya sedang giliran, sama seperti dia fold sendiri; kalau bukan, giliran tetap
  // di pemain yang sekarang, kecuali ronde taruhan jadi selesai karena dia keluar.
  forceFold(j) {
    const q = this.players[j]
    q.folded = true; q.forced = true; q.last = 'fold'
    if (j === this.turn) return this.step(j)
    const con = this.players.filter(p => p.inHand && !p.folded)
    if (con.length < 2) return this.finish(con)
    const live = con.filter(p => !p.allIn)
    if (live.every(p => p.acted && p.bet === this.bet) || (live.length < 2 && live.every(p => p.bet >= this.bet))) this.advance()
  }
  // Defend Me: pemain yang rugi di hand ini mendapat kembali setengah kerugiannya, diambil dari pemain yang untung
  // (sebanding dengan keuntungannya), jadi jumlah chip di meja tetap.
  defend() {
    const net = p => p.won - (p.paid ?? p.total) // chip bonus host bukan kerugian pemain
    const losers = this.players.filter(p => (p.skills || []).includes('defend_me') && net(p) < 0)
    if (!losers.length) return
    const gainers = this.players.filter(p => net(p) > 0)
    const pool = gainers.reduce((s, p) => s + net(p), 0)
    if (!pool) return
    const refund = losers.map(p => Math.floor(-net(p) / 2)), R = refund.reduce((s, x) => s + x, 0)
    let taken = 0
    gainers.forEach((p, k) => {
      const cut = k === gainers.length - 1 ? R - taken : Math.floor(R * net(p) / pool)
      p.chips -= cut; p.won -= cut; taken += cut
    })
    losers.forEach((p, k) => { p.chips += refund[k]; p.saved = refund[k]; if (!p.chips) p.allIn = true })
  }

  // Peluang menang semua pemain yang masih di hand, untuk host (yang hanya menerima angkanya, bukan kartunya).
  // Kunci berubah hanya saat kartu meja atau pemain yang tersisa berubah, supaya hasilnya bisa disimpan sementara.
  oddsKey() {
    if (!this.betting) return null
    return [this.handNo, this.rr || 0, this.board.join('.'), this.players.map((q, i) => q.inHand && !q.folded ? i : '').join(',')].join('|')
  }
  odds() {
    const live = this.players.map((q, i) => ({ q, i })).filter(({ q }) => q.inHand && !q.folded)
    if (!this.betting || live.length < 2) return live.map(({ i }) => ({ i, p: 1 }))
    const e = equities(live.map(({ q }) => q.cards), this.board)
    return live.map(({ i }, k) => ({ i, p: e[k] }))
  }

  // Pemain yang membuka kartu di showdown, dari kombinasi terlemah sampai terkuat (seri: urutan kursi).
  showdownOrder() {
    const last = this.phase === 'over' && this.lastShow === this.handNo
    if ((this.phase !== 'showdown' && !last) || this.board.length < 5) return []
    return this.players.map((q, i) => ({ q, i })).filter(({ q }) => q.inHand && !q.folded && q.show && q.score)
      .sort((a, b) => a.q.score - b.q.score || a.i - b.i)
  }

  // State untuk satu pemain (atau penonton kalau me = null): kartu lawan disembunyikan sampai showdown;
  // token, uid, dan dek tidak pernah ikut.
  // hostView: tampilan penonton untuk host match (tanda supaya halaman tahu ini host; kartu tetap tertutup).
  view(me, hostView = false) {
    const i = me ? this.players.indexOf(me) : -1, N = this.players
    // Reveal Card: pemakainya melihat kartu targetnya sampai hand selesai
    const peek = q => !!me && (((me.skills || []).includes('reveal_card') && N[me.target] === q) || (me.peekAt >= 0 && N[me.peekAt] === q)) && q.inHand && !q.folded
    const blindMe = !!me && me.blind && this.phase === 'preflop' // Blindfold: kartu sendiri tertutup sampai flop
    const sensed = (q, k) => !!me && me.sense && N[me.sense.j] === q && me.sense.k === k && this.betting && q.inHand && !q.folded
    const hand = q => (q === me ? q.inHand && !q.folded && !blindMe : (q.show || peek(q)) && !q.folded) && this.board.length > 2 ? handName(q.cards, this.board) : ''
    const seen = q => q === me || !this.betting || (q.skills || []).some(c => SKILLS[c]?.open)
    const lvl = this.level(), nextSb = LEVELS[Math.min(LEVELS.length - 1, lvl + 1)]
    const [sb, bb] = this.betting || this.phase === 'showdown' ? [this.sb, this.bb] : this.blinds()
    const v = {
      me: i, phase: this.phase, board: this.board, started: this.started, dealer: this.dealer, turn: this.turn,
      ms: this.turnMs(), sb, bb, no: this.handNo, level: lvl - this.level0 + 1,
      // ms sampai blind naik (berlaku di hand berikutnya sesudahnya); 0 = sudah level terakhir
      nextIn: this.startedAt === null || nextSb === LEVELS[lvl] ? 0 : Math.max(0, this.startedAt + (lvl - this.level0 + 1) * this.levelMs - this.now),
      next: [nextSb, nextSb * 2],
      startIn: this.startedAt === null && this.due ? Math.max(0, this.due.at - this.now) : 0,
      lobby: !!this.lobby, countdown: this.counting(),
      pot: this.betting ? N.reduce((s, q) => s + q.total + (q.boost || 0), 0) : 0,
      left: this.turn >= 0 && this.due ? Math.max(0, this.due.at - this.now) : 0,
      // showdown: kombinasi tiap pemain untuk disorot bergantian, terlemah dulu, pemenang terakhir
      reveal: this.showdownOrder().map(({ q, i }) => ({ i, best: bestFive(q.cards.concat(this.board)), hand: handName(q.cards, this.board) })),
      revealMs: REVEAL_MS, revealLead: REVEAL_LEAD_MS,
      afkLimit: AFK_HANDS, total: N.length, alive: N.filter(q => !q.place || q.place === 1).length,
      players: N.map(q => ({
        name: q.name, chips: q.chips, bet: q.bet, folded: q.folded, allIn: q.allIn, inHand: q.inHand, sitOut: q.sitOut,
        online: this.online(q), ready: !!q.ready, killed: !!q.killed, revived: q.revived || 0, won: q.won, fined: q.fined || 0, hand: hand(q), last: q.last, place: q.place, afk: q.afk || 0, afkOut: !!q.afkOut,
        // skill card yang dipakai hand ini: pemiliknya selalu tahu, pemain lain baru tahu saat kartu dibuka (showdown)
        skills: seen(q) ? q.skills || [] : [], target: q.target >= 0 && (q === me || (seen(q) && !(q.skills || []).some(c => SKILLS[c]?.secret))) ? q.target : -1, saved: q.saved || 0,
        forced: !!q.forced, peek: peek(q), countered: !!q.countered,
        cards: q === me && blindMe && !q.show ? [-1, -1] : q === me || q.show || peek(q) ? q.cards : q.inHand && !q.folded ? [0, 1].map(k => q.spot === k || sensed(q, k) ? q.cards[k] : -1) : [],
        iced: !!q.iced && this.betting, rescued: q.rescued || 0, back: q.back || 0, deathPaid: q.deathPaid || 0,
        spot: q.spot >= 0 && q.inHand && !q.folded ? q.spot : -1, insured: q.insured || 0,
      })),
    }
    if (i >= 0 && this.turn === i) v.ctl = this.ctl(i)
    if (me?.pre) v.pre = me.pre // pre-action saya (hanya terlihat sendiri)
    if (me && me.peekCard >= 0 && this.betting && this.board.length === me.peekLen) v.nextCard = me.peekCard // Board Peek
    if (me && me.third >= 0) v.thirdCard = me.third // Third Card: kartu ke-3 yang dibuang
    if (me?.sense && this.betting) v.sense = me.sense // Card Sense
    if (me && blindMe) v.blindfold = true
    if (this.death?.no === this.handNo && (this.betting || this.phase === 'showdown')) v.death = this.death.card
    if (this.ransom) v.ransomNext = true
    if (i >= 0 && this.luck?.i === i) v.luckNext = this.luck.code // kartu Luck saya menunggu hand berikutnya
    if (me && this.wild?.by === me.uid) v.wildNext = this.wild.code // wildcard saya menunggu hand ini selesai
    if (i >= 0) v.wildBusy = !!this.wild && this.wild.by !== me.uid
    // pengumuman kartu Attack/Wildcard di tengah meja (beberapa detik)
    if (this.ann && this.now - this.ann.at < WILD_MS + 1500) v.ann = this.ann
    if (this.duel) v.duel = this.duel
    if (this.revive) v.reviveNext = this.players.findIndex(p => p.uid === this.revive.target)
    if (this.big >= 0 && this.betting) v.big = this.big // Go Big or Go Home! aktif: fold kena denda
    if (this.duelFine >= 0 && this.betting) v.duelFine = this.duelFine // lawan Duel Me!: fold kena denda
    if (i >= 0 && this.turn === i && this.bigFine(i)) v.fine = this.bigFine(i)
    if (i >= 0) v.luckBusy = !!this.luck && this.luck.i !== i // pemain lain sudah memasang kartu Luck
    // hasil kartu Luck baru diberitahu sesudah hand selesai (kalau sebelumnya, pemiliknya tahu kartu meja akan cocok)
    if (me && !this.betting && me.lucky !== null && me.lucky !== undefined && (me.skills || []).some(c => SKILLS[c]?.luck)) v.lucky = me.lucky
    if (me && (this.counter || []).includes(me.uid)) v.counter = true // Full Counter saya aktif (hanya pemiliknya yang tahu)
    if (this.phase === 'over' && this.winner) v.winner = this.players.findIndex(p => p.uid === this.winner)
    if (hostView) { v.hostView = true; v.hostUsed = this.hostUsed === this.handNo; if (this.madness) v.madness = true }
    if (this.bounty) v.bounty = { i: this.players.findIndex(p => p.uid === this.bounty.uid), chips: this.bounty.chips }
    if (this.silenced()) v.silence = true
    if (this.speed === this.handNo && this.betting) v.speed = true
    const idx = u => this.players.findIndex(p => p.uid === u)
    if (this.betting && this.freeze?.no === this.handNo) v.freeze = idx(this.freeze.uid)
    if (this.hot) v.hot = idx(this.hot.uid)
    if (this.betting && this.shot?.no === this.handNo) v.shot = this.shot.uids.map(idx)
    if (this.betting && this.don === this.handNo) v.don = true
    if (this.betting && this.insure === this.handNo) v.insure = true
    if (this.betting && this.split === this.handNo) v.split = true
    if (this.finalTable) v.finalTable = true
    if (this.shuffleNext) v.shuffleNext = true
    return v
  }
}

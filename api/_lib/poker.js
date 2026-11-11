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
  // Wildcard: menarget pemain lain yang masih bertahan; dijalankan sesudah hand berjalan selesai, didahului jeda
  // pengumuman di tengah meja. Tidak bisa dipakai (dan batal, kartu dikembalikan) kalau pemain tersisa tinggal 2.
  you_owe_me: { name: 'You Owe Me My Money', icon: '💸', wild: true },
  duel_me: { name: 'Duel Me!', icon: '⚔️', wild: true },
  get_out: { name: 'Get The F*ck Out!', icon: '💀', wild: true },
}
/** Jeda pengumuman wildcard sebelum hand berikutnya dibagi. */
export const WILD_MS = env('WILD_MS', 5000)
/** Bagian chip target yang diambil You Owe Me My Money. */
export const OWE_SHARE = 0.8

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
// Jeda tambahan sebelum hand berikutnya: tiap kombinasi pemain disorot bergantian di layar.
export const REVEAL_MS = env('REVEAL_MS', 1500), REVEAL_LEAD_MS = 900

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
  level() { return Math.min(LEVELS.length - 1, this.level0 + (this.startedAt === null ? 0 : Math.floor((this.now - this.startedAt) / this.levelMs))) }
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
    let el = this.alive()
    if (el.length < 2) return this.end()
    this.duel = null
    if (this.duelNext) { // Duel Me!: hand ini hanya dua pemain itu; sisanya tidak dibagi kartu (auto fold)
      const pair = this.duelNext.map(u => this.players.find(p => p.uid === u)).filter(p => p && el.includes(p))
      this.duelNext = null
      if (pair.length === 2) { el = pair; this.duel = pair.map(p => this.players.indexOf(p)) }
    }
    if (this.startedAt === null) this.startedAt = this.now
    this.lobby = false
    ;[this.sb, this.bb] = this.blinds() // blind baru berlaku mulai hand berikutnya, tidak di tengah hand
    for (const p of this.players) Object.assign(p, { inHand: el.includes(p), folded: !el.includes(p), allIn: false, acted: false, noRaise: false, show: false, cards: [], bet: 0, total: 0, score: 0, won: 0, last: '', stack0: p.chips, skills: [], saved: 0, target: -1, forced: false, lucky: null })
    this.handNo++
    this.deck = this.newDeck(); this.board = []; this.phase = 'preflop'; this.bet = this.bb; this.minRaise = this.bb
    this.dealer = this.after(this.dealer, p => p.inHand)
    const sb = el.length === 2 ? this.dealer : this.after(this.dealer, p => p.inHand), bb = this.after(sb, p => p.inHand)
    el.forEach(p => p.cards = [this.deck.pop(), this.deck.pop()])
    this.applyLuck(el)
    this.put(this.players[sb], this.sb); this.put(this.players[bb], this.bb)
    this.players[sb].last = 'sb'; this.players[bb].last = 'bb'
    this.step(bb)
  }
  put(p, a) { a = Math.min(a, p.chips); p.chips -= a; p.bet += a; p.total += a; if (!p.chips) p.allIn = true }

  ctl(i) {
    const p = this.players[i], call = this.bet - p.bet, max = p.bet + p.chips
    return { call: Math.min(call, p.chips), bet: this.bet, minTo: Math.min(this.bet + this.minRaise, max), maxTo: max, raise: !p.noRaise && p.chips > call }
  }
  // Pemain yang tidak aktif cuma diberi waktu singkat supaya turnamen tidak tertahan.
  setTurn(i) { this.turn = i; const p = this.players[i]; this.defer('turn', p.sitOut || !this.online(p) ? AWAY_MS : TURN_MS) }
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
    if (type === 'fold') { p.folded = true; p.last = 'fold' }
    else if (type === 'check') { if (toCall) return 'Tidak bisa check, ada bet'; p.last = 'check' }
    else if (type === 'call') { const a = Math.min(toCall, p.chips); this.put(p, a); p.last = a ? 'call ' + a : 'check' }
    else if (type === 'raise') {
      const to = Math.min(Math.floor(+amount), p.bet + p.chips)
      if (!(to > this.bet) || p.noRaise) return 'Raise tidak valid'
      const full = to - this.bet >= this.minRaise
      if (!full && to < p.bet + p.chips) return `Minimal raise ke ${this.bet + this.minRaise}`
      p.last = (this.bet ? 'raise ' : 'bet ') + to
      this.put(p, to - p.bet)
      if (full) { this.minRaise = to - this.bet; for (const q of this.players) q.acted = q.noRaise = false }
      else for (const q of this.players) { if (q.acted) q.noRaise = true; q.acted = false } // all-in pendek tidak membuka raise lagi
      this.bet = to
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
    // taruhan yang tidak ada yang menyamai dikembalikan dulu (bukan "kemenangan")
    const [a, b] = [...this.players].sort((x, y) => y.total - x.total)
    if (b && a.total > b.total && a.inHand && !a.folded) { const r = a.total - b.total; a.chips += r; a.total -= r }
    const n = this.players.length, all = this.players.filter(p => p.total > 0)
    const levels = [...new Set(con.map(p => p.total))].sort((x, y) => x - y), seat = p => (this.players.indexOf(p) - this.dealer - 1 + n) % n
    let prev = 0
    levels.forEach((L, k) => {
      const cap = k === levels.length - 1 ? Infinity : L // level terakhir menyerap sisa kontribusi pemain fold
      const pot = all.reduce((s, p) => s + Math.min(p.total, cap) - Math.min(p.total, prev), 0)
      const el = con.filter(p => p.total >= L), top = Math.max(...el.map(p => p.score))
      const ws = el.filter(p => p.score === top).sort((x, y) => seat(x) - seat(y)), share = Math.floor(pot / ws.length), rem = pot - share * ws.length
      ws.forEach((p, j) => { const g = share + (j < rem ? 1 : 0); p.chips += g; p.won += g }) // sisa chip ganjil ke pemenang pertama sesudah dealer
      prev = L
    })
    this.defend()
    for (const p of this.players) { p.bet = 0; if (!p.folded) p.last = '' }
    this.phase = 'showdown'; this.turn = -1; this.hands++
    // hitung hand AFK: masih istirahat di akhir hand = AFK; beraksi atau menekan "Main lagi" = mulai dari 0
    for (const p of this.players) if (p.inHand && !p.place) p.afk = p.sitOut ? (p.afk || 0) + 1 : 0
    this.eliminate()
    if (this.alive().length < 2) return this.end()
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

  sitIn(i) { this.players[i].sitOut = false; this.players[i].afk = 0 }

  // ---- skill card di meja ----
  // Satu kartu per pemain per hand, hanya selama hand berjalan dan pemain belum fold.
  // Kartu Attack butuh target j: lawan yang masih ikut hand. Fold Player hanya sebelum flop dan tidak ke pemain all-in.
  canUseCard(i, code, j) {
    const p = this.players[i], sk = SKILLS[code]
    if (!sk) return 'Kartu ini tidak bisa dipakai di meja'
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
    if (!this.betting) return 'Skill card hanya bisa dipakai selama hand berjalan'
    if (!p || !p.inHand || p.folded) return 'Kamu sudah tidak ikut hand ini'
    if ((p.skills || []).length) return 'Maksimal 1 skill card per hand'
    if (!sk.target) return
    const q = this.players[j]
    if (!Number.isInteger(j) || !q || j === i) return 'Pilih lawan yang mau ditarget'
    if (!q.inHand || q.folded) return `${q.name} sudah tidak ikut hand ini`
    if (code === 'fold_player') {
      if (this.phase !== 'preflop') return 'Fold Player hanya bisa dipakai sebelum flop'
      if (q.allIn) return `${q.name} sudah all-in, tidak bisa dipaksa fold`
    }
  }
  useCard(i, code, j, card = null) {
    const err = this.canUseCard(i, code, j)
    if (err) return err
    const p = this.players[i]
    if (SKILLS[code].luck) { this.luck = { i, code }; return }
    if (SKILLS[code].wild) {
      this.wild = { by: p.uid, target: this.players[j].uid, code, card, shown: false }
      if (!this.betting) this.defer('next', Math.max(0, Math.min(this.due ? this.due.at - this.now : 0, 1500))) // di antara hand: segera
      return
    }
    p.skills = [...(p.skills || []), code]
    if (SKILLS[code].target) p.target = j
    if (SKILLS[code].open) this.announce(i, code, SKILLS[code].secret ? -1 : j) // kartu Attack langsung diumumkan di tengah meja
    if (code === 'fold_player') this.forceFold(j)
  }
  // Pengumuman di tengah meja: siapa memakai kartu apa ke siapa (extra = keterangan hasil).
  announce(i, code, j, extra = '') {
    this.annN = (this.annN || 0) + 1
    this.ann = { n: this.annN, at: this.now, by: i, code, target: j, extra }
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
    if (R(100) >= SKILLS[L.code].chance) return
    const r = rigLuck(SKILLS[L.code].luck)
    if (!r) return
    // bagi ulang: pemilik mendapat kartu susunan, pemain lain dari sisa dek, lalu kartu meja ditaruh di ujung dek
    const used = new Set(r.hole.concat(r.board))
    this.deck = this.newDeck().filter(c => !used.has(c))
    for (const p of el) p.cards = p === o ? r.hole : [this.deck.pop(), this.deck.pop()]
    this.deck.push(...r.board.slice().reverse()) // pop() berikutnya = board[0], board[1], ...
    o.lucky = true
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
    const net = p => p.won - p.total
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
    return [this.handNo, this.board.join('.'), this.players.map((q, i) => q.inHand && !q.folded ? i : '').join(',')].join('|')
  }
  odds() {
    const live = this.players.map((q, i) => ({ q, i })).filter(({ q }) => q.inHand && !q.folded)
    if (!this.betting || live.length < 2) return live.map(({ i }) => ({ i, p: 1 }))
    const e = equities(live.map(({ q }) => q.cards), this.board)
    return live.map(({ i }, k) => ({ i, p: e[k] }))
  }

  // Pemain yang membuka kartu di showdown, dari kombinasi terlemah sampai terkuat (seri: urutan kursi).
  showdownOrder() {
    if (this.phase !== 'showdown' || this.board.length < 5) return []
    return this.players.map((q, i) => ({ q, i })).filter(({ q }) => q.inHand && !q.folded && q.show && q.score)
      .sort((a, b) => a.q.score - b.q.score || a.i - b.i)
  }

  // State untuk satu pemain (atau penonton kalau me = null): kartu lawan disembunyikan sampai showdown;
  // token, uid, dan dek tidak pernah ikut.
  // hostView: tampilan penonton untuk host match (tanda supaya halaman tahu ini host; kartu tetap tertutup).
  view(me, hostView = false) {
    const i = me ? this.players.indexOf(me) : -1, N = this.players
    // Reveal Card: pemakainya melihat kartu targetnya sampai hand selesai
    const peek = q => !!me && (me.skills || []).includes('reveal_card') && N[me.target] === q && q.inHand && !q.folded
    const hand = q => (q === me ? q.inHand && !q.folded : (q.show || peek(q)) && !q.folded) && this.board.length > 2 ? handName(q.cards, this.board) : ''
    const seen = q => q === me || !this.betting || (q.skills || []).some(c => SKILLS[c]?.open)
    const lvl = this.level(), nextSb = LEVELS[Math.min(LEVELS.length - 1, lvl + 1)]
    const [sb, bb] = this.betting || this.phase === 'showdown' ? [this.sb, this.bb] : this.blinds()
    const v = {
      me: i, phase: this.phase, board: this.board, started: this.started, dealer: this.dealer, turn: this.turn,
      ms: TURN_MS, sb, bb, no: this.handNo, level: lvl - this.level0 + 1,
      // ms sampai blind naik (berlaku di hand berikutnya sesudahnya); 0 = sudah level terakhir
      nextIn: this.startedAt === null || nextSb === LEVELS[lvl] ? 0 : Math.max(0, this.startedAt + (lvl - this.level0 + 1) * this.levelMs - this.now),
      next: [nextSb, nextSb * 2],
      startIn: this.startedAt === null && this.due ? Math.max(0, this.due.at - this.now) : 0,
      lobby: !!this.lobby, countdown: this.counting(),
      pot: this.betting ? N.reduce((s, q) => s + q.total, 0) : 0,
      left: this.turn >= 0 && this.due ? Math.max(0, this.due.at - this.now) : 0,
      // showdown: kombinasi tiap pemain untuk disorot bergantian, terlemah dulu, pemenang terakhir
      reveal: this.showdownOrder().map(({ q, i }) => ({ i, best: bestFive(q.cards.concat(this.board)), hand: handName(q.cards, this.board) })),
      revealMs: REVEAL_MS, revealLead: REVEAL_LEAD_MS,
      afkLimit: AFK_HANDS, total: N.length, alive: N.filter(q => !q.place || q.place === 1).length,
      players: N.map(q => ({
        name: q.name, chips: q.chips, bet: q.bet, folded: q.folded, allIn: q.allIn, inHand: q.inHand, sitOut: q.sitOut,
        online: this.online(q), ready: !!q.ready, killed: !!q.killed, won: q.won, hand: hand(q), last: q.last, place: q.place, afk: q.afk || 0, afkOut: !!q.afkOut,
        // skill card yang dipakai hand ini: pemiliknya selalu tahu, pemain lain baru tahu saat kartu dibuka (showdown)
        skills: seen(q) ? q.skills || [] : [], target: q.target >= 0 && (q === me || (seen(q) && !(q.skills || []).some(c => SKILLS[c]?.secret))) ? q.target : -1, saved: q.saved || 0,
        forced: !!q.forced, peek: peek(q),
        cards: q === me || q.show || peek(q) ? q.cards : q.inHand && !q.folded ? [-1, -1] : [],
      })),
    }
    if (i >= 0 && this.turn === i) v.ctl = this.ctl(i)
    if (i >= 0 && this.luck?.i === i) v.luckNext = this.luck.code // kartu Luck saya menunggu hand berikutnya
    if (me && this.wild?.by === me.uid) v.wildNext = this.wild.code // wildcard saya menunggu hand ini selesai
    if (i >= 0) v.wildBusy = !!this.wild && this.wild.by !== me.uid
    // pengumuman kartu Attack/Wildcard di tengah meja (beberapa detik)
    if (this.ann && this.now - this.ann.at < WILD_MS + 1500) v.ann = this.ann
    if (this.duel) v.duel = this.duel
    if (i >= 0) v.luckBusy = !!this.luck && this.luck.i !== i // pemain lain sudah memasang kartu Luck
    // hasil kartu Luck baru diberitahu sesudah hand selesai (kalau sebelumnya, pemiliknya tahu kartu meja akan cocok)
    if (me && !this.betting && me.lucky !== null && me.lucky !== undefined && (me.skills || []).some(c => SKILLS[c]?.luck)) v.lucky = me.lucky
    if (hostView) v.hostView = true
    return v
  }
}

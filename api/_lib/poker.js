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
const AWAY_MS = env('AWAY_MS', 3000), NEXT_MS = env('NEXT_MS', 6000), RUNOUT_MS = env('RUNOUT_MS', 1500), FIRST_MS = env('FIRST_MS', 15000)
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
   * Hand pertama dibagi FIRST_MS setelah meja dibuat, supaya pemain sempat membuka meja.
   */
  static create(seats, cfg, now) {
    const t = new Table()
    t.now = now
    const order = seats.slice()
    for (let i = order.length - 1; i > 0; i--) { const j = randomInt(i + 1); [order[i], order[j]] = [order[j], order[i]] }
    for (const s of order) t.players.push({
      uid: s.uid, name: String(s.name).slice(0, 20), token: null, chips: cfg.start_chips, seen: 0, sitOut: false,
      inHand: false, folded: false, allIn: false, acted: false, noRaise: false, show: false, cards: [], bet: 0, total: 0,
      score: 0, won: 0, last: '', stack0: 0, place: 0, afk: 0, afkOut: false,
    })
    t.level0 = Math.max(0, LEVELS.indexOf(cfg.sb))
    t.levelMs = cfg.level_minutes * 60000
    ;[t.sb, t.bb] = t.blinds()
    t.started = true
    t.defer('start', FIRST_MS)
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
    const el = this.alive()
    if (el.length < 2) return this.end()
    if (this.startedAt === null) this.startedAt = this.now
    ;[this.sb, this.bb] = this.blinds() // blind baru berlaku mulai hand berikutnya, tidak di tengah hand
    for (const p of this.players) Object.assign(p, { inHand: el.includes(p), folded: !el.includes(p), allIn: false, acted: false, noRaise: false, show: false, cards: [], bet: 0, total: 0, score: 0, won: 0, last: '', stack0: p.chips })
    this.handNo++
    this.deck = this.newDeck(); this.board = []; this.phase = 'preflop'; this.bet = this.bb; this.minRaise = this.bb
    this.dealer = this.after(this.dealer, p => p.inHand)
    const sb = el.length === 2 ? this.dealer : this.after(this.dealer, p => p.inHand), bb = this.after(sb, p => p.inHand)
    el.forEach(p => p.cards = [this.deck.pop(), this.deck.pop()])
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
    for (const p of afk) { this.forfeited += p.chips; p.chips = 0; p.afkOut = true }
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

  sitIn(i) { this.players[i].sitOut = false; this.players[i].afk = 0 }

  // Pemain yang membuka kartu di showdown, dari kombinasi terlemah sampai terkuat (seri: urutan kursi).
  showdownOrder() {
    if (this.phase !== 'showdown' || this.board.length < 5) return []
    return this.players.map((q, i) => ({ q, i })).filter(({ q }) => q.inHand && !q.folded && q.show && q.score)
      .sort((a, b) => a.q.score - b.q.score || a.i - b.i)
  }

  // State untuk satu pemain (atau penonton kalau me = null): kartu lawan disembunyikan sampai showdown;
  // token, uid, dan dek tidak pernah ikut.
  view(me) {
    const i = me ? this.players.indexOf(me) : -1, N = this.players
    const hand = q => (q === me ? q.inHand && !q.folded : q.show && !q.folded) && this.board.length > 2 ? handName(q.cards, this.board) : ''
    const lvl = this.level(), nextSb = LEVELS[Math.min(LEVELS.length - 1, lvl + 1)]
    const [sb, bb] = this.betting || this.phase === 'showdown' ? [this.sb, this.bb] : this.blinds()
    const v = {
      me: i, phase: this.phase, board: this.board, started: this.started, dealer: this.dealer, turn: this.turn,
      ms: TURN_MS, sb, bb, no: this.handNo, level: lvl - this.level0 + 1,
      // ms sampai blind naik (berlaku di hand berikutnya sesudahnya); 0 = sudah level terakhir
      nextIn: this.startedAt === null || nextSb === LEVELS[lvl] ? 0 : Math.max(0, this.startedAt + (lvl - this.level0 + 1) * this.levelMs - this.now),
      next: [nextSb, nextSb * 2],
      startIn: this.startedAt === null && this.due ? Math.max(0, this.due.at - this.now) : 0,
      pot: this.betting ? N.reduce((s, q) => s + q.total, 0) : 0,
      left: this.turn >= 0 && this.due ? Math.max(0, this.due.at - this.now) : 0,
      // showdown: kombinasi tiap pemain untuk disorot bergantian, terlemah dulu, pemenang terakhir
      reveal: this.showdownOrder().map(({ q, i }) => ({ i, best: bestFive(q.cards.concat(this.board)), hand: handName(q.cards, this.board) })),
      revealMs: REVEAL_MS, revealLead: REVEAL_LEAD_MS,
      afkLimit: AFK_HANDS, total: N.length, alive: N.filter(q => !q.place || q.place === 1).length,
      players: N.map(q => ({
        name: q.name, chips: q.chips, bet: q.bet, folded: q.folded, allIn: q.allIn, inHand: q.inHand, sitOut: q.sitOut,
        online: this.online(q), won: q.won, hand: hand(q), last: q.last, place: q.place, afk: q.afk || 0, afkOut: !!q.afkOut,
        cards: q === me || q.show ? q.cards : q.inHand && !q.folded ? [-1, -1] : [],
      })),
    }
    if (i >= 0 && this.turn === i) v.ctl = this.ctl(i)
    return v
  }
}

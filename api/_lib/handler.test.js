// Tes API meja dengan database tiruan di memori: `node api/_lib/handler.test.js`
import assert from 'node:assert'
import { api } from './handler.js'

const MATCH = '11111111-2222-3333-4444-555555555555'
const users = { tokA: 'uA', tokB: 'uB', tokC: 'uC', tokX: 'uX', tokH: 'uH' }

function fakeDb() {
  const m = { status: 'ongoing', mode: 'online', dealer_id: 'uH', online_config: { sb: 10, start_chips: 300, level_minutes: 10 } }
  const players = [{ uid: 'uA', name: 'Andi' }, { uid: 'uB', name: 'Bela' }, { uid: 'uC', name: 'Citra' }]
  let row = null
  const results = { out: [], winner: null }
  const yieldTurn = () => new Promise(r => setImmediate(r)) // beri kesempatan request lain menyela (uji jalur tabrakan)
  return {
    m, results, get row() { return row },
    async user(t) { await yieldTurn(); return users[t] ?? null },
    async seats() { await yieldTurn(); return { match: m, players } },
    async meta() { await yieldTurn(); return row && { ver: row.ver, due_at: row.due_at, status: m.status } },
    async load() { await yieldTurn(); return row && { state: structuredClone(row.state), ver: row.ver, status: m.status } },
    async podium() { return [{ player_id: 'uB', rank: 1 }] },
    cards: { c1: { owner: 'uA', code: 'defend_me', used: false } },
    async useCard(_, player, card) {
      await yieldTurn()
      const c = this.cards[card]
      if (!c || c.owner !== player || c.used) throw new Error('Kartu tidak ada di inventory atau tidak bisa dipakai di meja')
      c.used = true
      return c.code
    },
    async refundCard(_, player, card) { const c = this.cards[card]; if (c && c.owner === player) c.used = false },
    async create(_, state, due) { await yieldTurn(); if (row) return null; row = { state, ver: 1, due_at: due }; return 1 },
    async save(_, ver, state, due, out, winner) {
      await yieldTurn()
      if (m.status !== 'ongoing') throw new Error('match_not_ongoing')
      if (row.ver !== ver) return null
      row = { state, ver: ver + 1, due_at: due }
      results.out = out
      if (winner) { results.winner = winner; m.status = 'finished' }
      return row.ver
    },
  }
}

const db = fakeDb()
const post = body => api(db, { method: 'POST', body: { match: MATCH, ...body } })
const get = query => api(db, { method: 'GET', query: { match: MATCH, ...query } })

assert.equal((await api(db, { method: 'GET', query: { match: 'bukan-uuid' } })).error, 'Match tidak valid')
assert((await post({ type: 'join', access_token: 'salah' })).auth)

// tiga pemain bergabung bersamaan: meja dibuat sekali, tiap pemain dapat token sendiri
const [a, b, c] = await Promise.all(['tokA', 'tokB', 'tokC'].map(t => post({ type: 'join', access_token: t })))
assert(a.token && b.token && c.token && new Set([a.token, b.token, c.token]).size === 3)
assert.equal(a.s.players.length, 3)
assert.equal((await post({ type: 'join', access_token: 'tokA' })).token, a.token) // perangkat lain: token sama
const x = await post({ type: 'join', access_token: 'tokX' })
assert(x.watch && !x.token && !x.host) // bukan pemain match: penonton
const hst = await post({ type: 'join', access_token: 'tokH' })
assert(hst.host && hst.token && hst.s.hostView) // host match: token sendiri, boleh chat
assert.equal((await post({ type: 'join', access_token: 'tokH' })).token, hst.token)
assert(![a.token, b.token, c.token].includes(hst.token))
assert.equal((await post({ token: hst.token, type: 'check' })).gone, true) // host tidak bisa beraksi
const hv = await get({ token: hst.token })
assert(hv.s.hostView && hv.s.me === -1)
assert(hv.s.players.every(q => q.cards.every(c => c === -1)) && !JSON.stringify(hv).includes('"best"'))
assert(!a.host)
const w = await get({ watch: '1' })
assert.equal(w.s.me, -1)
assert(!JSON.stringify(w).includes('uA'))

// versi tidak berubah dan belum ada event: jawaban ringan tanpa memuat state
const s1 = await get({ token: a.token })
assert.equal(s1.s.hostView, undefined)
assert.deepEqual(await get({ token: a.token, v: String(s1.v) }), { same: true, v: s1.v })
assert((await get({ token: 'ngawur' })).gone)

// bingkai podium: B peringkat 1 all time (tanpa uid di respons)
assert.equal(s1.s.players.find(q => q.name === 'Bela').podium, 1)
assert(!JSON.stringify(s1).includes('"uB"'))
// mulai: majukan jam ke hand pertama (meja menunggu 15 detik)
const realNow = Date.now
let offset = 0
Date.now = () => realNow() + offset
offset += 16000
const tok = { [a.token]: 'A', [b.token]: 'B', [c.token]: 'C' }
let s = (await get({ token: a.token })).s
assert.equal(s.phase, 'preflop')
// skill card: kartu orang lain / kartu tidak dikenal ditolak; kartu sendiri terpakai sekali
const CARD = '99999999-2222-3333-4444-555555555555'
db.cards[CARD] = db.cards.c1
assert((await post({ token: b.token, type: 'card', card: CARD, code: 'defend_me' })).error)
assert((await post({ token: a.token, type: 'card', card: CARD, code: 'reveal' })).error)
const used = await post({ token: a.token, type: 'card', card: CARD, code: 'defend_me' })
assert(used.ok && used.s.players[used.s.me].skills.includes('defend_me'), JSON.stringify(used.error))
assert((await post({ token: a.token, type: 'card', card: CARD, code: 'defend_me' })).error)
// kartu yang terpakai di database tapi gagal di meja dikembalikan (di sini: kode yang dikirim tidak cocok, target kosong)
const RV = '99999999-2222-3333-4444-666666666666'
db.cards[RV] = { owner: 'uB', code: 'reveal_card', used: false }
assert((await post({ token: b.token, type: 'card', card: RV, code: 'defend_me' })).error)
assert.equal(db.cards[RV].used, false, 'kartu dikembalikan')
const sb = (await get({ token: b.token })).s, tgt = sb.players.findIndex((q, k) => k !== sb.me && q.inHand && !q.folded)
const rv = await post({ token: b.token, type: 'card', card: RV, code: 'reveal_card', target: tgt })
assert(rv.ok && rv.s.players[tgt].cards.every(c => c >= 0) && rv.s.players[tgt].peek, JSON.stringify(rv.error))
s = (await get({ token: a.token })).s
// pemain hanya melihat kartunya sendiri; host juga tidak melihat kartu tertutup siapa pun, hanya peluang menang
assert.deepEqual(s.players.filter((_, k) => k !== s.me).map(q => q.cards), [[-1, -1], [-1, -1]])
const hs = (await get({ token: hst.token })).s
assert(hs.players.every(q => q.cards.every(c => c === -1)))
assert.equal(hs.odds.length, 3)
assert(Math.abs(hs.odds.reduce((x, o) => x + o.p, 0) - 1) < 1e-9)
assert.equal(s.odds, undefined) // pemain tidak menerima peluang orang lain

// tiap giliran: pemain yang sedang giliran all-in; ulangi sampai turnamen selesai
let guard = 0
while (!db.results.winner && ++guard < 500) {
  const views = await Promise.all([a, b, c].map(p => get({ token: p.token })))
  const turn = views.find(r => r.s && r.s.ctl)
  if (turn) {
    const who = [a, b, c][views.indexOf(turn)]
    const r = await post({ token: who.token, type: turn.s.ctl.raise ? 'raise' : 'call', amount: turn.s.ctl.maxTo })
    assert(!r.error, r.error)
  } else offset += 7000 // tunggu runout / hand berikutnya
}
assert(db.results.winner, 'turnamen tidak selesai')
assert.equal(db.results.out.length, 2)
assert(!db.results.out.includes(db.results.winner))
assert(Object.values(tok).length === 3)

// sesudah selesai: aksi ditolak, state akhir masih bisa dilihat
assert((await post({ token: a.token, type: 'check' })).ended)
const fin = await get({ token: a.token })
assert.equal(fin.s.phase, 'over')
assert.deepEqual(fin.s.players.map(p => p.place).sort(), [1, 2, 3])

// match dibatalkan host: meja berhenti
db.m.status = 'cancelled'
assert.deepEqual(await get({ token: a.token, v: '1' }), { ended: true, status: 'cancelled' })
Date.now = realNow
console.log('semua tes handler lulus')

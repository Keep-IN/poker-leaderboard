// Logika API meja poker online, terpisah dari penyimpanan supaya bisa diuji tanpa Supabase.
//   GET  /api/meja?match=&token=&v=          -> state meja untuk pemain itu ({same:true} kalau tidak berubah)
//   GET  /api/meja?match=&watch=1&v=         -> state untuk penonton (tanpa kartu tertutup)
//   POST /api/meja {match, type:'join', access_token}       -> {token} untuk pemain match ini
//   POST /api/meja {match, token, type, amount}             -> fold | check | call | raise | sitin | ready | unready
//   POST /api/meja {match, token, type:'out'}               -> keluar dari match di lobi (sebelum hand pertama)
//   POST /api/meja {match, token: host, type:'kick', seat}  -> host mengeluarkan pemain di lobi
//
// db: {
//   user(accessToken) -> uid | null
//   seats(match) -> { match: {status, mode, online_config, dealer_id}, players: [{uid, name}] } | null
//   meta(match) -> { ver, due_at, status } | null           (ringan, tanpa state)
//   load(match) -> { state, ver, status } | null
//   create(match, state, dueAt) -> ver | null
//   save(match, ver, state, dueAt, out, winner) -> ver baru | null (kalah balapan) ; throw 'match_not_ongoing'
//   withdraw(match, uid)  -> pemain keluar dari match (hapus dari match_players) ; throw kalau hand pertama sudah dibagi
// }
import { randomUUID } from 'node:crypto'
import { Table } from './poker.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const SEEN_MS = 5000

const dueOf = t => (t.due ? new Date(t.due.at).toISOString() : null)
// Postgres jsonb menyusun ulang urutan kunci, jadi bandingkan state dengan kunci yang diurutkan.
const canon = v => Array.isArray(v) ? v.map(canon)
  : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canon(v[k])])) : v
const key = v => JSON.stringify(canon(v))
const ended = status => ({ ended: true, status })

// Bingkai podium (3 besar all time) di kursi meja: daftar disimpan sementara 5 menit per instance server.
let podium = { at: 0, ranks: new Map() }
async function podiumRanks(db) {
  if (!db.podium || Date.now() - podium.at < 5 * 60000) return podium.ranks
  try { podium = { at: Date.now(), ranks: new Map((await db.podium()).map(r => [r.player_id, r.rank])) } } catch { podium.at = Date.now() }
  return podium.ranks
}
// Tambahkan peringkat podium ke tiap kursi (tanpa membocorkan uid).
async function withPodium(db, t, res) {
  if (!res || !res.s || !t) return res
  const ranks = await podiumRanks(db)
  res.s.players.forEach((q, k) => { const r = ranks.get(t.players[k]?.uid); if (r) q.podium = r })
  return res
}

// Jalankan fn pada state terbaru lalu simpan kalau berubah. Optimistic locking: kalau request lain menulis lebih dulu,
// ulangi dengan state baru (fn hanya boleh mengubah t). Event yang sudah jatuh tempo dijalankan dulu (t.tick).
async function mutate(db, match, fn) {
  for (let i = 0; i < 12; i++) {
    if (i) await new Promise(r => setTimeout(r, Math.random() * 15 * i)) // jeda acak yang membesar supaya tidak bentrok lagi
    const row = await db.load(match)
    if (!row) return { missing: true }
    if (row.status !== 'ongoing') return { status: row.status }
    const before = key(row.state) // snapshot dulu: Table.from memakai objek pemain yang sama dengan row.state
    const t = Table.from(row.state)
    t.now = Date.now()
    t.tick()
    const out = fn(t), next = JSON.parse(JSON.stringify(t))
    if (key(next) === before) return { t, out, ver: row.ver }
    try {
      const ver = await db.save(match, row.ver, next, dueOf(t), t.out, t.winner)
      if (ver !== null) return { t, out, ver }
    } catch (e) {
      if (String(e.message).includes('match_not_ongoing')) return { status: 'ended' }
      throw e
    }
  }
  throw new Error('Meja sedang ramai, coba lagi')
}

// Meja dibuat saat ada yang pertama kali membukanya setelah match dimulai.
async function ensureTable(db, match) {
  if (await db.meta(match)) return
  const info = await db.seats(match)
  if (!info || info.match.mode !== 'online' || info.match.status !== 'ongoing') return
  const t = Table.create(info.players, info.match.online_config, Date.now())
  await db.create(match, JSON.parse(JSON.stringify(t)), dueOf(t))
}

// Tampilan host: seperti penonton (kartu tertutup) ditambah peluang menang semua pemain yang masih di hand.
// Peluang dihitung di server supaya kartu pemain tidak pernah dikirim ke host; hasilnya disimpan per keadaan kartu.
const oddsCache = new Map()
function hostView(match, t) {
  const s = t.view(null, true), key = t.oddsKey()
  if (!key) return s
  const ck = match + '|' + key
  if (!oddsCache.has(ck)) {
    if (oddsCache.size > 200) oddsCache.clear()
    oddsCache.set(ck, t.odds())
  }
  s.odds = oddsCache.get(ck)
  return s
}

async function getState(db, match, token, v, watch) {
  if (v !== undefined && v !== '') {
    const m = await db.meta(match)
    if (!m) return { error: 'Meja belum dibuka', missing: true }
    if (m.status !== 'ongoing' && m.status !== 'finished') return ended(m.status)
    // tidak berubah dan belum ada event jatuh tempo: tidak perlu memuat state
    if (+v === m.ver && (!m.due_at || Date.parse(m.due_at) > Date.now())) return { same: true, v: m.ver }
  }
  const r = await mutate(db, match, t => {
    const p = t.find(token)
    if (p && t.now - p.seen > SEEN_MS) p.seen = t.now
  })
  if (r.missing) return { error: 'Meja belum dibuka', missing: true }
  if (r.status === 'finished') return finalView(db, match, token)
  if (r.status) return ended(r.status)
  if (token && token === r.t.hostToken) return withPodium(db, r.t, { v: r.ver, s: hostView(match, r.t) })
  const p = r.t.find(token)
  if (!p && !watch) return { gone: true }
  return withPodium(db, r.t, { v: r.ver, s: r.t.view(p ?? null) })
}

// Turnamen selesai: match sudah 'finished', state terakhir tetap bisa dilihat.
async function finalView(db, match, token) {
  const row = await db.load(match)
  if (!row) return ended('finished')
  const t = Table.from(row.state)
  t.now = Date.now()
  return { v: row.ver, s: t.view(t.find(token) ?? null) }
}

async function join(db, match, accessToken) {
  const uid = await db.user(String(accessToken || ''))
  if (!uid) return { error: 'Sesi login habis, buka ulang dari halaman match', auth: true }
  await ensureTable(db, match)
  // Host match (tidak ikut main) mendapat token sendiri supaya tetap dikenali sebagai host (boleh chat) setelah refresh.
  const host = (await db.seats(match))?.match.dealer_id === uid
  const r = await mutate(db, match, t => {
    const p = t.players.find(q => q.uid === uid)
    if (!p && host) { if (!t.hostToken) t.hostToken = randomUUID(); return { token: t.hostToken, host: true } }
    if (!p) return { watch: true }
    if (!p.token) p.token = randomUUID() // satu token per pemain, dipakai juga kalau buka dari perangkat lain
    p.seen = t.now
    return { token: p.token }
  })
  if (r.missing) return { error: 'Meja hanya bisa dibuka setelah match online dimulai' }
  if (r.status) return r.status === 'finished' ? { watch: true, ...(host && { host: true }) } : ended(r.status)
  return withPodium(db, r.t, { ...r.out, v: r.ver, s: r.out.host ? hostView(match, r.t) : r.t.view(r.t.find(r.out.token) ?? null) })
}

// Pakai skill card dari inventory: cek dulu di meja (masih di hand, belum pakai kartu), lalu tandai kartu terpakai
// di database (memastikan kartu milik pemain ini), baru efeknya dipasang di meja.
async function playCard(db, match, b) {
  const token = String(b.token || ''), cardId = String(b.card || '')
  if (!UUID_RE.test(cardId)) return { error: 'Kartu tidak valid' }
  const peek = await db.load(match)
  if (!peek || peek.status !== 'ongoing') return ended(peek?.status ?? 'ended')
  const t0 = Table.from(peek.state), p0 = t0.find(token)
  if (!p0) return { error: 'Sesi meja tidak ditemukan, buka ulang dari halaman match', gone: true }
  t0.now = Date.now(); t0.tick()
  const code = String(b.code || ''), target = b.target === undefined || b.target === null ? -1 : Number(b.target)
  const pre = t0.canUseCard(t0.players.indexOf(p0), code, target)
  if (pre) return { error: pre }
  let used
  try { used = await db.useCard(match, p0.uid, cardId) } catch (e) { return { error: String(e.message).replace(/^.*?: /, '') } }
  let r
  try {
    r = await mutate(db, match, t => {
      const p = t.find(token)
      const err = p ? t.useCard(t.players.indexOf(p), used, target) : 'Sesi meja tidak ditemukan'
      return err ? { error: err } : { ok: true, used }
    })
  } catch (e) { r = { error: e } }
  // kartu sudah ditandai terpakai di database tapi tidak jadi dipakai (misalnya target keburu fold): kembalikan
  if (r.error || r.status || r.out?.error) await db.refundCard(match, p0.uid, cardId).catch(() => {})
  if (r.error) throw r.error
  if (r.status) return ended(r.status)
  const p = r.t?.find(token)
  return p ? withPodium(db, r.t, { ...r.out, v: r.ver, s: r.t.view(p) }) : r.out
}

// Out di lobi (pemain sendiri) atau dikeluarkan host: cek di meja, catat di database, lalu hapus kursinya.
async function leave(db, match, b) {
  const token = String(b.token || '')
  const peek = await db.load(match)
  if (!peek || peek.status !== 'ongoing') return ended(peek?.status ?? 'ended')
  const t0 = Table.from(peek.state)
  t0.now = Date.now(); t0.tick()
  const isHost = !!token && token === t0.hostToken
  let i = -1
  if (b.type === 'kick') {
    if (!isHost) return { error: 'Hanya host yang bisa mengeluarkan pemain' }
    i = Number(b.seat)
    if (!Number.isInteger(i) || !t0.players[i]) return { error: 'Pemain tidak ditemukan' }
    if (t0.players[i].ready) return { error: `${t0.players[i].name} sudah Ready` }
  } else {
    const p = t0.find(token)
    if (!p) return { error: 'Sesi meja tidak ditemukan, buka ulang dari halaman match', gone: true }
    i = t0.players.indexOf(p)
  }
  const pre = t0.canWithdraw(i)
  if (pre) return { error: pre }
  const uid = t0.players[i].uid
  try { await db.withdraw(match, uid) } catch (e) { return { error: String(e.message).replace(/^.*?: /, '') } }
  const r = await mutate(db, match, t => {
    const k = t.players.findIndex(q => q.uid === uid)
    if (k < 0) return { ok: true }
    const err = t.withdraw(k, true)
    return err ? { error: err } : { ok: true }
  })
  if (r.status) return ended(r.status)
  if (isHost) return withPodium(db, r.t, { ...r.out, v: r.ver, s: hostView(match, r.t) })
  return { ...r.out, left: true } // pemain yang keluar tidak punya kursi lagi
}

async function act(db, match, b) {
  if (b.type === 'card') return playCard(db, match, b)
  if (b.type === 'out' || b.type === 'kick') return leave(db, match, b)
  const token = String(b.token || '')
  const r = await mutate(db, match, t => {
    const p = t.find(token)
    if (!p) return { error: 'Sesi meja tidak ditemukan, buka ulang dari halaman match', gone: true }
    p.seen = t.now
    if (['fold', 'check', 'call', 'raise'].includes(b.type)) p.sitOut = false // pemain yang beraksi berarti sudah kembali
    const i = t.players.indexOf(p)
    const err = b.type === 'sitin' ? t.sitIn(i) : b.type === 'ready' || b.type === 'unready' ? t.setReady(i, b.type === 'ready') : t.act(i, b.type, b.amount)
    return err ? { error: err } : { ok: true }
  })
  if (r.missing) return { error: 'Meja belum dibuka', missing: true }
  if (r.status) return ended(r.status)
  const p = r.t.find(token)
  return p ? withPodium(db, r.t, { ...r.out, v: r.ver, s: r.t.view(p) }) : r.out
}

export async function api(db, { method, query = {}, body = {} }) {
  const b = method === 'GET' ? query : body
  const match = String(b.match || '').toLowerCase()
  if (!UUID_RE.test(match)) return { error: 'Match tidak valid' }
  if (method === 'GET') return getState(db, match, String(b.token || ''), b.v, b.watch === '1' || b.watch === true)
  if (method === 'POST') return b.type === 'join' ? join(db, match, b.access_token) : act(db, match, b)
  return { error: 'Metode tidak didukung' }
}

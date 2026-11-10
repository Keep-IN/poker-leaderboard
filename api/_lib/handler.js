// Logika API meja poker online, terpisah dari penyimpanan supaya bisa diuji tanpa Supabase.
//   GET  /api/meja?match=&token=&v=          -> state meja untuk pemain itu ({same:true} kalau tidak berubah)
//   GET  /api/meja?match=&watch=1&v=         -> state untuk penonton (tanpa kartu tertutup)
//   POST /api/meja {match, type:'join', access_token}       -> {token} untuk pemain match ini
//   POST /api/meja {match, token, type, amount}             -> fold | check | call | raise | sitin
//
// db: {
//   user(accessToken) -> uid | null
//   seats(match) -> { match: {status, mode, online_config}, players: [{uid, name}] } | null
//   meta(match) -> { ver, due_at, status } | null           (ringan, tanpa state)
//   load(match) -> { state, ver, status } | null
//   create(match, state, dueAt) -> ver | null
//   save(match, ver, state, dueAt, out, winner) -> ver baru | null (kalah balapan) ; throw 'match_not_ongoing'
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
  const p = r.t.find(token)
  if (!p && !watch) return { gone: true }
  return { v: r.ver, s: r.t.view(p ?? null) }
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
  const r = await mutate(db, match, t => {
    const p = t.players.find(q => q.uid === uid)
    if (!p) return { watch: true }
    if (!p.token) p.token = randomUUID() // satu token per pemain, dipakai juga kalau buka dari perangkat lain
    p.seen = t.now
    return { token: p.token }
  })
  if (r.missing) return { error: 'Meja hanya bisa dibuka setelah match online dimulai' }
  if (r.status) return r.status === 'finished' ? { watch: true } : ended(r.status)
  return { ...r.out, v: r.ver, s: r.t.view(r.t.find(r.out.token) ?? null) }
}

async function act(db, match, b) {
  const token = String(b.token || '')
  const r = await mutate(db, match, t => {
    const p = t.find(token)
    if (!p) return { error: 'Sesi meja tidak ditemukan, buka ulang dari halaman match', gone: true }
    p.seen = t.now
    if (['fold', 'check', 'call', 'raise'].includes(b.type)) p.sitOut = false // pemain yang beraksi berarti sudah kembali
    const i = t.players.indexOf(p)
    const err = b.type === 'sitin' ? t.sitIn(i) : t.act(i, b.type, b.amount)
    return err ? { error: err } : { ok: true }
  })
  if (r.missing) return { error: 'Meja belum dibuka', missing: true }
  if (r.status) return ended(r.status)
  const p = r.t.find(token)
  return p ? { ...r.out, v: r.ver, s: r.t.view(p) } : r.out
}

export async function api(db, { method, query = {}, body = {} }) {
  const b = method === 'GET' ? query : body
  const match = String(b.match || '').toLowerCase()
  if (!UUID_RE.test(match)) return { error: 'Match tidak valid' }
  if (method === 'GET') return getState(db, match, String(b.token || ''), b.v, b.watch === '1' || b.watch === true)
  if (method === 'POST') return b.type === 'join' ? join(db, match, b.access_token) : act(db, match, b)
  return { error: 'Metode tidak didukung' }
}

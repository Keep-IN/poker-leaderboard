// Fungsi Vercel untuk meja poker online. State meja disimpan di Supabase (tabel online_tables).
import { api } from './_lib/handler.js'
import { supabaseDb } from './_lib/supabase-db.js'

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const db = supabaseDb(url, process.env.SUPABASE_SECRET_KEY)
// Publishable key (memang publik) untuk chat realtime di meja; meja.html tidak dibangun lewat Vite.
const rt = url && process.env.VITE_SUPABASE_KEY ? { url, key: process.env.VITE_SUPABASE_KEY } : null

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (!db) return res.status(503).json({ error: 'Server meja belum dikonfigurasi' })
  try {
    const body = req.method === 'POST' ? (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}) : {}
    const out = await api(db, { method: req.method, query: req.query || {}, body })
    res.status(200).json(body.type === 'join' && !out.error && rt ? { ...out, rt } : out)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error: ' + e.message })
  }
}

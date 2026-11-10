// Fungsi Vercel untuk meja poker online. State meja disimpan di Supabase (tabel online_tables).
import { api } from './_lib/handler.js'
import { supabaseDb } from './_lib/supabase-db.js'

const db = supabaseDb(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY)

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (!db) return res.status(503).json({ error: 'Server meja belum dikonfigurasi' })
  try {
    const body = req.method === 'POST' ? (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}) : {}
    res.status(200).json(await api(db, { method: req.method, query: req.query || {}, body }))
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error: ' + e.message })
  }
}

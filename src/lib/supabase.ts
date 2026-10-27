import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_KEY as string | undefined

export const isConfigured = Boolean(url && key)

export const supabase = createClient(url ?? 'http://localhost', key ?? 'missing-key')

export type Role = 'player' | 'dealer'
export type MatchStatus = 'open' | 'ongoing' | 'finished' | 'cancelled'
export type PlayerStatus = 'playing' | 'eliminated' | 'winner'

export interface Profile {
  id: string
  name: string
  role: Role
}

export interface Match {
  id: string
  title: string
  dealer_id: string
  status: MatchStatus
  max_players: number
  winner_id: string | null
  created_at: string
  started_at: string | null
  finished_at: string | null
}

export interface MatchPlayer {
  match_id: string
  player_id: string
  status: PlayerStatus
  joined_at: string
  eliminated_at: string | null
  /** Final rank (1 = winner), set when the match finishes. */
  placement: number | null
  points: number
  profile: { name: string } | null
}

export interface LeaderboardRow {
  player_id: string
  name: string
  points: number
  wins: number
  played: number
}

/** Turns Supabase/Postgres errors into short Indonesian messages. */
export function errorMessage(err: unknown): string {
  const msg = err && typeof err === 'object' && 'message' in err ? String(err.message) : String(err)
  if (/invalid login credentials/i.test(msg)) return 'Email atau password salah'
  if (/already registered|already been registered/i.test(msg)) return 'Email sudah terdaftar'
  if (/password should be at least/i.test(msg)) return 'Password minimal 6 karakter'
  if (/email not confirmed/i.test(msg)) return 'Email belum dikonfirmasi, cek inbox kamu'
  if (/rate limit/i.test(msg)) return 'Terlalu banyak percobaan, coba lagi nanti'
  if (/failed to fetch/i.test(msg)) return 'Gagal terhubung ke server'
  return msg
}

/** Mirrors the generated `match_players.points` column. */
export const POINTS_BY_PLACEMENT = [10, 5, 1] as const

/** Points a player pays to host a match (refunded if it is cancelled). Mirrors `match_creation_cost()` in the database. */
export const MATCH_CREATION_COST = 1

/** Matches need at least this many players to start (prevents 1-vs-1 point farming). Mirrors start_match(). */
export const MIN_MATCH_PLAYERS = 3

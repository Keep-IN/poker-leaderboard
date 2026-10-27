export type DuelStatus = 'pending' | 'accepted' | 'approved' | 'finished' | 'declined' | 'cancelled' | 'rejected'

export interface Duel {
  id: string
  challenger_id: string
  opponent_id: string
  stake: number
  status: DuelStatus
  dealer_id: string | null
  winner_id: string | null
  created_at: string
  finished_at: string | null
  challenger: { name: string } | null
  opponent: { name: string } | null
  dealer: { name: string } | null
}

/** Select string for a duel with both players' and the host dealer's names. */
export const DUEL_SELECT =
  '*, challenger:profiles!duels_challenger_id_fkey(name), opponent:profiles!duels_opponent_id_fkey(name), dealer:profiles!duels_dealer_id_fkey(name)'

export const ACTIVE_DUEL_STATUSES: DuelStatus[] = ['pending', 'accepted', 'approved']

export function duelNames(d: Duel) {
  return { a: d.challenger?.name ?? 'Player', b: d.opponent?.name ?? 'Player' }
}

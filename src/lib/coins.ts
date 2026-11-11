import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

export interface Claimable {
  reason: 'launch' | 'milestone' | 'salary'
  ref: string
  amount: number
  label: string
}

export interface LedgerRow {
  id: string
  amount: number
  reason: 'launch' | 'match' | 'salary' | 'milestone' | 'purchase' | 'gift'
  ref: string
  created_at: string
}

export const LEDGER_LABELS: Record<LedgerRow['reason'], string> = {
  launch: 'Bonus peluncuran',
  match: 'Hasil match',
  salary: 'Gaji bulanan',
  milestone: 'Pencapaian',
  purchase: 'Beli skill card',
  gift: 'Gift dari dealer',
}

/** Coin balance and coins ready to claim for the signed-in player. */
export function useCoins(enabled = true) {
  const [balance, setBalance] = useState<number | null>(null)
  const [claimable, setClaimable] = useState<Claimable[]>([])

  const load = useCallback(async () => {
    if (!enabled) return
    const [b, c] = await Promise.all([supabase.rpc('get_my_coins'), supabase.rpc('get_claimable_coins')])
    setBalance(Number(b.data ?? 0))
    setClaimable((c.data as Claimable[]) ?? [])
  }, [enabled])

  useEffect(() => {
    load()
  }, [load])

  async function claim() {
    const { data, error } = await supabase.rpc('claim_coins')
    await load()
    return { got: Number(data ?? 0), error }
  }

  return { balance, claimable, reload: load, claim }
}

/** Total-points milestones that pay coins once each. Mirrors claimable_coins(). */
export const MILESTONES = [
  { points: 50, coins: 30 },
  { points: 100, coins: 50 },
  { points: 250, coins: 80 },
  { points: 500, coins: 120 },
]

// ---- podium all time: bingkai avatar untuk 3 besar, dipakai di semua tempat avatar tampil ----

export const PODIUM_TITLES: Record<number, string> = { 1: 'Raja Meja', 2: 'Tangan Dingin', 3: 'Penantang' }

export const PodiumContext = createContext<Map<string, number>>(new Map())

export function usePodiumRank(id: string | undefined) {
  const map = useContext(PodiumContext)
  return id ? map.get(id) ?? 0 : 0
}

/** Loads the all-time top 3 once (standard competition ranking, so ties share a place). */
export function usePodiumMap() {
  const [map, setMap] = useState<Map<string, number>>(new Map())
  useEffect(() => {
    supabase.rpc('get_leaderboard', {}).then(({ data }) => {
      const rows = ((data as { player_id: string; points: number }[]) ?? []).map((r) => ({ id: r.player_id, points: Number(r.points) }))
      const next = new Map<string, number>()
      rows.forEach((r, i) => {
        const rank = i > 0 && rows[i - 1].points === r.points ? next.get(rows[i - 1].id) ?? i + 1 : i + 1
        if (rank <= 3) next.set(r.id, rank)
      })
      setMap(next)
    })
  }, [])
  return map
}

import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

export type BountyStatus = 'active' | 'claimed' | 'cancelled'

export interface Bounty {
  id: string
  target_id: string
  reward: number
  status: BountyStatus
  created_at: string
  claimed_by: string | null
  claimed_at: string | null
  match_id: string | null
  target: { name: string } | null
  claimer: { name: string } | null
}

export const BOUNTY_SELECT =
  '*, target:profiles!bounties_target_id_fkey(name), claimer:profiles!bounties_claimed_by_fkey(name)'

/** Active bounties plus the last few claimed ones, kept live through realtime. */
export function useBounties(channel: string) {
  const [active, setActive] = useState<Bounty[] | null>(null)
  const [recent, setRecent] = useState<Bounty[]>([])

  const load = useCallback(async () => {
    const [a, r] = await Promise.all([
      supabase.from('bounties').select(BOUNTY_SELECT).eq('status', 'active').order('reward', { ascending: false }),
      supabase.from('bounties').select(BOUNTY_SELECT).eq('status', 'claimed').order('claimed_at', { ascending: false }).limit(5),
    ])
    setActive((a.data as unknown as Bounty[]) ?? [])
    setRecent((r.data as unknown as Bounty[]) ?? [])
  }, [])

  useEffect(() => {
    load()
    const sub = supabase
      .channel(channel)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bounties' }, load)
      .subscribe()
    return () => {
      supabase.removeChannel(sub)
    }
  }, [channel, load])

  return { active, recent, reload: load }
}

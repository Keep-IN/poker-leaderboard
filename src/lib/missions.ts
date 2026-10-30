import { useEffect, useState } from 'react'

export interface Mission {
  id: string
  required_wins: number
  min_stake: number
  reward: number
  deadline: string
  status: 'active' | 'cancelled'
  created_at: string
  creator: { name: string } | null
  rewards: { count: number }[]
}

/** A mission with the signed-in player's progress, from get_my_missions(). */
export interface MyMission {
  id: string
  required_wins: number
  min_stake: number
  reward: number
  deadline: string
  created_at: string
  wins: number
  completed: boolean
}

export const MISSION_SELECT = '*, creator:profiles!missions_created_by_fkey(name), rewards:point_adjustments(count)'

export function missionText(m: { required_wins: number; min_stake: number }) {
  return `Menangkan ${m.required_wins} duel dengan taruhan minimal ${m.min_stake} poin`
}

/** Current time, ticking every second. */
export function useNow() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

/** "2 hari 05:13:09", or "05:13:09" under a day. */
export function formatCountdown(ms: number) {
  if (ms <= 0) return 'Berakhir'
  const s = Math.floor(ms / 1000)
  const days = Math.floor(s / 86400)
  const pad = (n: number) => String(n).padStart(2, '0')
  const clock = `${pad(Math.floor((s % 86400) / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`
  return days > 0 ? `${days} hari ${clock}` : clock
}

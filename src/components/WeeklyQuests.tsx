import { useCallback, useEffect, useState } from 'react'
import { formatCountdown, useNow } from '../lib/missions'
import { errorMessage, supabase } from '../lib/supabase'
import { Card, ErrorText, SectionTitle, cx } from './ui'

interface Quest { code: string; title: string; target: number; reward: number; progress: number; claimed: boolean; week: string; ends_at: string }

const ICONS: Record<string, string> = {
  win_hands: '🃏', showdowns: '🎴', knockouts: '💥', big_hands: '🌈', allin_wins: '🔥', use_cards: '🎒',
  play_matches: '🎲', play_online: '🌐', top_three: '🥉', champion: '🏆',
}

/** Quest mingguan otomatis (3 per minggu, ganti tiap Senin WIB) dengan progres dan tombol klaim. */
export function WeeklyQuests({ me }: { me: string }) {
  const [quests, setQuests] = useState<Quest[] | null>(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [got, setGot] = useState('')
  const now = useNow()

  const load = useCallback(async () => {
    const { data } = await supabase.rpc('get_my_quests')
    setQuests((data as Quest[]) ?? [])
  }, [])
  useEffect(() => {
    load()
    const sub = supabase
      .channel(`quests-${me}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, load)
      .subscribe()
    return () => {
      supabase.removeChannel(sub)
    }
  }, [me, load])

  async function claim(q: Quest) {
    setBusy(q.code)
    setError('')
    setGot('')
    const { error } = await supabase.rpc('claim_quest', { p_code: q.code })
    setBusy('')
    if (error) return setError(errorMessage(error))
    setGot(`+${q.reward} koin dari "${q.title}"`)
    window.dispatchEvent(new Event('coins:changed'))
    load()
  }

  if (!quests || quests.length === 0) return null
  const left = new Date(quests[0].ends_at).getTime() - now
  const done = quests.filter((q) => q.claimed).length

  return (
    <section>
      <div className="flex items-end justify-between gap-2">
        <SectionTitle>📋 Quest mingguan</SectionTitle>
        <span className="mb-2 text-xs text-slate-400">
          {done}/{quests.length} selesai · ganti dalam {formatCountdown(left)}
        </span>
      </div>
      <Card className="divide-y divide-ink/5 p-0">
        {quests.map((q) => {
          const full = q.progress >= q.target
          return (
            <div key={q.code} className="flex items-center gap-3 px-4 py-3">
              <span className="text-2xl">{ICONS[q.code] ?? '📋'}</span>
              <div className="min-w-0 flex-1">
                <p className={cx('text-sm font-semibold', q.claimed && 'text-slate-400 line-through')}>{q.title}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink/10">
                    <div className={cx('h-full rounded-full transition-all', full ? 'bg-emerald-400' : 'bg-brand-400')} style={{ width: `${(q.progress / q.target) * 100}%` }} />
                  </div>
                  <span className="text-xs tabular-nums text-slate-400">
                    {q.progress}/{q.target}
                  </span>
                </div>
              </div>
              {q.claimed ? (
                <span className="rounded-lg bg-emerald-500/15 px-2.5 py-1.5 text-xs font-bold text-emerald-300">✓ +{q.reward}</span>
              ) : (
                <button
                  type="button"
                  disabled={!full || busy === q.code}
                  onClick={() => claim(q)}
                  className={cx(
                    'min-h-9 shrink-0 rounded-lg px-3 text-xs font-bold transition',
                    full ? 'animate-pulse bg-amber-400 text-[#1a1000] hover:bg-amber-300' : 'bg-ink/5 text-slate-400',
                  )}
                >
                  {full ? `Klaim ${q.reward} 🪙` : `${q.reward} 🪙`}
                </button>
              )}
            </div>
          )
        })}
      </Card>
      <ErrorText>{error}</ErrorText>
      {got && <p className="mt-2 rounded-xl bg-emerald-500/15 px-3 py-2 text-sm text-emerald-300">🎉 {got}</p>}
    </section>
  )
}

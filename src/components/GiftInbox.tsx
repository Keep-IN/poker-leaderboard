import { useCallback, useEffect, useState } from 'react'
import { giftText } from '../pages/Gifts'
import { supabase } from '../lib/supabase'

interface Gift {
  id: string
  coins: number
  card_code: string | null
  card_qty: number
  message: string | null
  created_at: string
  card: { name: string } | null
}

/** Gift dari dealer yang menunggu diklaim, di Beranda player. Setelah diklaim, koin/kartu langsung masuk. */
export default function GiftInbox({ me, onClaimed }: { me: string; onClaimed?: () => void }) {
  const [gifts, setGifts] = useState<Gift[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [got, setGot] = useState('')

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('gifts')
      .select('id, coins, card_code, card_qty, message, created_at, card:skill_cards(name)')
      .eq('player_id', me)
      .eq('status', 'pending')
      .order('created_at')
    setGifts((data as unknown as Gift[]) ?? [])
  }, [me])

  useEffect(() => {
    load()
    const sub = supabase
      .channel(`gifts-${me}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gifts', filter: `player_id=eq.${me}` }, load)
      .subscribe()
    return () => {
      supabase.removeChannel(sub)
    }
  }, [me, load])

  async function claim(id: string | null) {
    setBusy(id ?? 'all')
    const claimed = id ? gifts.filter((g) => g.id === id) : gifts
    const { error } = await supabase.rpc('claim_gift', { p_gift: id })
    setBusy(null)
    if (!error) {
      setGot('🎉 ' + claimed.map((g) => giftText(g, g.card?.name)).join(' · ') + ' masuk ke akunmu')
      setTimeout(() => setGot(''), 4000)
      onClaimed?.()
    }
    load()
  }

  if (!gifts.length && !got) return null
  return (
    <section className="space-y-2">
      {got && <p className="rounded-2xl bg-emerald-500/15 px-4 py-3 text-sm font-medium text-emerald-300">{got}</p>}
      {gifts.length > 0 && (
        <div className="gift-box overflow-hidden rounded-2xl border border-fuchsia-400/50 bg-gradient-to-br from-fuchsia-500/20 via-surface-800/80 to-amber-500/15">
          <div className="flex items-center justify-between gap-3 px-4 pt-3">
            <p className="font-bold">
              <span className="gift-bounce mr-1 inline-block">🎁</span> Gift dari dealer{gifts.length > 1 ? ` (${gifts.length})` : ''}
            </p>
            {gifts.length > 1 && (
              <button onClick={() => claim(null)} disabled={!!busy} className="rounded-xl bg-amber-400 px-3 py-1.5 text-xs font-bold text-[#04122b] disabled:opacity-60">
                {busy === 'all' ? '…' : 'Klaim semua'}
              </button>
            )}
          </div>
          <div className="divide-y divide-ink/5">
            {gifts.map((g) => (
              <div key={g.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{giftText(g, g.card?.name)}</p>
                  {g.message && <p className="truncate text-xs italic text-slate-300">“{g.message}”</p>}
                </div>
                <button onClick={() => claim(g.id)} disabled={!!busy} className="shrink-0 rounded-xl bg-amber-400 px-4 py-1.5 text-sm font-bold text-[#04122b] disabled:opacity-60">
                  {busy === g.id ? '…' : 'Klaim'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

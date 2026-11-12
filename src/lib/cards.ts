import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

export type CardKind = 'passive' | 'attack' | 'luck' | 'defend' | 'wildcard' | 'angelic'

export interface SkillCard {
  code: string
  name: string
  kind: CardKind
  description: string
  price: number
  stock: number
  on_sale: boolean
  sort: number
}

export interface OwnedCard {
  id: string
  card_code: string
  status: 'owned' | 'armed' | 'used'
  price: number
  bought_at: string
  match_id: string | null
  used_at: string | null
  card: Pick<SkillCard, 'name' | 'kind' | 'description'> | null
}

export const KIND_LABELS: Record<CardKind, { label: string; icon: string; tone: string }> = {
  passive: { label: 'Passive', icon: '⚡', tone: 'bg-amber-500/15 text-amber-300' },
  attack: { label: 'Attack', icon: '🗡️', tone: 'bg-chip-red/15 text-red-300' },
  luck: { label: 'Luck', icon: '🍀', tone: 'bg-emerald-500/15 text-emerald-300' },
  defend: { label: 'Defend', icon: '🛡️', tone: 'bg-sky-500/15 text-sky-300' },
  wildcard: { label: 'Wildcard', icon: '☠️', tone: 'bg-[#ff2d55]/20 text-[#ff8da0] ring-1 ring-[#ff2d55]/50' },
  angelic: { label: 'Angelic', icon: '✦', tone: 'bg-[#fff6d6] text-[#9a7408] ring-1 ring-[#e9c85a]' },
}

export const CARD_ICONS: Record<string, string> = { double_down: '⚡', defend_me: '🛡️', reveal_card: '👁️', fold_player: '🚫',
  give_me_straight: '🪜', give_me_flush: '💧', give_me_full_house: '🏠', give_me_quads: '🎲', give_me_straight_flush: '🌈', give_me_royal_flush: '👑',
  you_owe_me: '💸', duel_me: '⚔️', get_out: '💀', go_big: '🔥', card_reroll: '🔄', revive: '😇', pair_me_up: '👯', full_counter: '🪞' }

/** Urutan tampil: cursed paling atas, lalu angelic, lalu sisanya. */
export const kindRank = (k: string | undefined) => (k === 'wildcard' ? 0 : k === 'angelic' ? 1 : 2)

/** The signed-in player's cards (RLS only returns their own). */
export function useMyCards() {
  const [cards, setCards] = useState<OwnedCard[] | null>(null)
  const load = useCallback(async () => {
    const { data } = await supabase
      .from('player_cards')
      .select('*, card:skill_cards(name, kind, description)')
      .order('bought_at', { ascending: false })
    setCards((data as unknown as OwnedCard[]) ?? [])
  }, [])
  useEffect(() => {
    load()
  }, [load])
  return { cards, reload: load }
}

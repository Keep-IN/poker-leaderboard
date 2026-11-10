import { formatDateTime } from './format'
import { missionText, type Mission } from './missions'
import { formatChips, onlineConfigText, pointsFor, type Match, type MatchPlayer } from './supabase'

// Pesan siap kirim ke grup WhatsApp. Format WA: *tebal*, _miring_.

/** Opens WhatsApp (app on phones, WhatsApp Web/desktop on laptops) with the message filled in; the user picks the group. */
export function shareToWhatsApp(text: string) {
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
}

const link = (path: string) => `${window.location.origin}${path}`

type ShareMatch = Pick<Match, 'id' | 'title' | 'status' | 'mode' | 'online_config' | 'max_players'> & {
  dealer: { name: string; role: string } | null
}

export function matchMessage(match: ShareMatch, players: MatchPlayer[]) {
  const online = match.mode === 'online'
  const url = link(`/matches/${match.id}`)
  const host = `${match.dealer?.role === 'player' ? 'Host' : 'Dealer'}: ${match.dealer?.name ?? '-'}`
  const kind = online && match.online_config ? `🌐 Online · ${onlineConfigText(match.online_config)}` : '🃏 Offline'
  const names = players.map((p) => p.profile?.name ?? 'Player')

  if (match.status === 'open') {
    const left = match.max_players - players.length
    return [
      `🃏 *Match baru: ${match.title}*`,
      kind,
      `${host} · maks ${match.max_players} pemain`,
      players.length ? `Sudah join (${players.length}): ${names.join(', ')}` : 'Belum ada yang join, ayo jadi yang pertama!',
      left > 0 ? `Sisa ${left} kursi.` : 'Kursi sudah penuh.',
      '',
      `Join di sini 👉 ${url}`,
    ].join('\n')
  }

  if (match.status === 'ongoing') {
    return [
      `▶️ *Match dimulai: ${match.title}*`,
      kind,
      `Pemain (${players.length}): ${names.join(', ')}`,
      `Poin: 🏆 ${pointsFor(1, players.length, match.mode)} · 🥈 ${pointsFor(2, players.length, match.mode)}` +
        (pointsFor(3, players.length, match.mode) > 0 ? ` · 🥉 ${pointsFor(3, players.length, match.mode)}` : ''),
      '',
      online ? `Masuk / nonton meja 👉 ${url}` : `Pantau live 👉 ${url}`,
    ].join('\n')
  }

  const medals = ['🥇', '🥈', '🥉']
  const podium = players
    .filter((p) => p.placement && p.placement <= 3)
    .sort((a, b) => (a.placement ?? 0) - (b.placement ?? 0))
    .map((p) => `${medals[(p.placement ?? 1) - 1]} ${p.profile?.name ?? 'Player'}${p.points > 0 ? ` (+${formatChips(p.points)} poin)` : ''}`)
  return [
    `🏆 *Hasil match: ${match.title}*`,
    `${online ? '🌐 Online' : '🃏 Offline'} · ${players.length} pemain`,
    '',
    ...podium,
    '',
    `Hasil lengkap 👉 ${url}`,
    `Leaderboard 👉 ${link('/leaderboard')}`,
  ].join('\n')
}

export function missionMessage(m: Pick<Mission, 'kind' | 'match_mode' | 'required_wins' | 'min_stake' | 'reward' | 'deadline'>) {
  return [
    '🎯 *Misi baru!*',
    `_${missionText(m)}_`,
    `Reward: *+${formatChips(m.reward)} poin*`,
    `Deadline: ${formatDateTime(m.deadline)}`,
    '',
    `Cek progres di Beranda 👉 ${link('/')}`,
  ].join('\n')
}

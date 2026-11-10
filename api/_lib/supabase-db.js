// Penyimpanan meja online di Supabase lewat REST, memakai secret key (melewati RLS). Hanya dipakai di server.
export function supabaseDb(url, secret) {
  if (!url || !secret) return null
  const headers = { apikey: secret, 'Content-Type': 'application/json' }

  async function rest(path, init = {}) {
    const r = await fetch(url + path, { ...init, headers: { ...headers, ...init.headers } })
    const body = await r.text()
    const json = body ? JSON.parse(body) : null
    if (!r.ok) throw new Error(json?.message || `Supabase ${r.status}`)
    return json
  }
  const rpc = (fn, args) => rest(`/rest/v1/rpc/${fn}`, { method: 'POST', body: JSON.stringify(args) })
  const one = async path => (await rest(path))[0] ?? null

  return {
    async user(accessToken) {
      if (!accessToken) return null
      const r = await fetch(url + '/auth/v1/user', { headers: { apikey: secret, Authorization: 'Bearer ' + accessToken } })
      if (!r.ok) return null
      return (await r.json()).id ?? null
    },
    async seats(match) {
      const m = await one(`/rest/v1/matches?id=eq.${match}&select=status,mode,online_config,dealer_id,players:match_players(player_id,profile:profiles(name))`)
      if (!m) return null
      return { match: m, players: m.players.map(p => ({ uid: p.player_id, name: p.profile?.name ?? 'Player' })) }
    },
    async meta(match) {
      const r = await one(`/rest/v1/online_tables?match_id=eq.${match}&select=ver,due_at,match:matches(status)`)
      return r && { ver: r.ver, due_at: r.due_at, status: r.match.status }
    },
    async load(match) {
      const r = await one(`/rest/v1/online_tables?match_id=eq.${match}&select=state,ver,match:matches(status)`)
      return r && { state: r.state, ver: r.ver, status: r.match.status }
    },
    create: (match, state, dueAt) => rpc('meja_create', { p_match: match, p_state: state, p_due: dueAt }),
    save: (match, ver, state, dueAt, out, winner) =>
      rpc('meja_save', { p_match: match, p_ver: ver, p_state: state, p_due: dueAt, p_out: out, p_winner: winner }),
  }
}

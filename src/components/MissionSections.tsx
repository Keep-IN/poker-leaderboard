import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatDateTime } from '../lib/format'
import { MISSION_SELECT, formatCountdown, missionText, useNow, type Mission, type MissionKind, type MyMission } from '../lib/missions'
import { missionMessage, shareToWhatsApp } from '../lib/share'
import { errorMessage, supabase, type MatchMode } from '../lib/supabase'
import ConfirmSheet from './ConfirmSheet'
import { Card, ErrorText, SectionTitle, cx } from './ui'

/** Runs `load` now and whenever missions, duels or matches change (a finished duel or match moves progress). */
function useLive(name: string, load: () => void) {
  useEffect(() => {
    load()
    const sub = supabase
      .channel(name)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'missions' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'duels' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, load)
      .subscribe()
    return () => {
      supabase.removeChannel(sub)
    }
  }, [name, load])
}

export function PlayerMissions({ me }: { me: string }) {
  const [missions, setMissions] = useState<MyMission[]>([])
  const now = useNow()

  const load = useCallback(async () => {
    const { data } = await supabase.rpc('get_my_missions')
    setMissions((data as MyMission[]) ?? [])
  }, [])
  useLive(`missions-player-${me}`, load)

  const visible = missions.filter((m) => new Date(m.deadline).getTime() > now)
  if (visible.length === 0) return null

  return (
    <section>
      <SectionTitle>🎯 Misi</SectionTitle>
      <div className="grid gap-2">
        {visible.map((m) => {
          const left = new Date(m.deadline).getTime() - now
          const streak = m.kind === 'match_streak'
          const progress = m.completed ? m.required_wins : Math.min(m.wins, m.required_wins)
          return (
            <Card key={m.id} className={m.completed ? 'border-emerald-400/40' : 'border-brand-400/40'}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <MissionKindLabel kind={m.kind} mode={m.match_mode} />
                  <p className="font-semibold">{missionText(m)}</p>
                </div>
                <span className="shrink-0 rounded-lg bg-brand-400/15 px-2 py-1 text-xs font-bold text-brand-300">+{m.reward} poin</span>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink/8">
                  <div
                    className={cx('h-full rounded-full transition-all', m.completed ? 'bg-emerald-400' : 'bg-brand-400')}
                    style={{ width: `${(progress / m.required_wins) * 100}%` }}
                  />
                </div>
                <span className="shrink-0 text-xs font-semibold text-slate-300">
                  {streak ? `🔥 ${progress}/${m.required_wins} beruntun` : `${progress}/${m.required_wins} menang`}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs">
                {m.completed ? (
                  <span className="font-semibold text-emerald-300">✓ Selesai · +{m.reward} poin sudah masuk</span>
                ) : streak ? (
                  <span className="text-slate-400">Kalah sekali, streak mulai dari 0{m.best > 0 && ` · terbaik ${m.best}`}</span>
                ) : (
                  <span className="text-slate-400">Duel di bawah {m.min_stake} poin tidak dihitung</span>
                )}
                <span
                  className={cx(
                    'shrink-0 font-mono font-semibold tabular-nums',
                    left < 86_400_000 && !m.completed ? 'text-red-300' : 'text-slate-300',
                  )}
                >
                  ⏱ {formatCountdown(left)}
                </span>
              </div>
            </Card>
          )
        })}
      </div>
    </section>
  )
}

export function DealerMissions() {
  const [missions, setMissions] = useState<Mission[]>([])
  const [cancelling, setCancelling] = useState<Mission | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const now = useNow()

  const load = useCallback(async () => {
    const { data } = await supabase.from('missions').select(MISSION_SELECT).order('created_at', { ascending: false }).limit(20)
    setMissions((data as unknown as Mission[]) ?? [])
  }, [])
  useLive('missions-dealer', load)

  const active = missions.filter((m) => m.status === 'active' && new Date(m.deadline).getTime() > now)
  const ended = missions.filter((m) => !active.includes(m)).slice(0, 5)

  async function cancel(m: Mission) {
    setBusy(true)
    setError('')
    const { error } = await supabase.rpc('cancel_mission', { p_mission: m.id })
    if (error) setError(errorMessage(error))
    await load()
    setBusy(false)
    setCancelling(null)
  }

  return (
    <section>
      <div className="flex items-center justify-between">
        <SectionTitle>🎯 Misi</SectionTitle>
        <Link to="/missions/new" className="mb-2 text-sm font-semibold text-brand-400 hover:text-brand-300">
          ＋ Buat misi
        </Link>
      </div>
      <ErrorText>{error}</ErrorText>

      {active.length === 0 ? (
        <Card>
          <p className="text-center text-sm text-slate-400">Belum ada misi aktif. Buat misi duel atau misi match supaya player makin semangat main.</p>
        </Card>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {active.map((m) => (
            <Card key={m.id} className="border-brand-400/30">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <MissionKindLabel kind={m.kind} mode={m.match_mode} />
                  <p className="font-semibold">{missionText(m)}</p>
                </div>
                <span className="shrink-0 rounded-lg bg-brand-400/15 px-2 py-1 text-xs font-bold text-brand-300">+{m.reward} poin</span>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                <span>{m.rewards[0]?.count ?? 0} player selesai</span>
                <span className="font-mono font-semibold tabular-nums text-slate-300">
                  ⏱ {formatCountdown(new Date(m.deadline).getTime() - now)}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 text-xs">
                <button
                  onClick={() => shareToWhatsApp(missionMessage(m))}
                  className="font-semibold text-emerald-300 hover:text-emerald-200"
                >
                  📲 Kirim ke grup WA
                </button>
                <button onClick={() => setCancelling(m)} className="text-slate-500 hover:text-slate-300">
                  Batalkan misi
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {ended.length > 0 && (
        <Card className="mt-2 divide-y divide-ink/5 p-0">
          {ended.map((m) => (
            <div key={m.id} className="flex items-center gap-3 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-slate-300">{missionText(m)}</p>
                <p className="text-xs text-slate-500">
                  {m.status === 'cancelled' ? 'Dibatalkan' : `Berakhir ${formatDateTime(m.deadline)}`} · {m.rewards[0]?.count ?? 0} player selesai
                </p>
              </div>
              <span className="shrink-0 text-xs text-slate-500">+{m.reward}</span>
            </div>
          ))}
        </Card>
      )}

      {cancelling && (
        <ConfirmSheet
          title="Batalkan misi?"
          text={`"${missionText(cancelling)}" akan hilang dari dashboard player. Reward yang sudah didapat player tetap jadi milik mereka.`}
          action="Ya, batalkan"
          danger
          loading={busy}
          run={() => cancel(cancelling)}
          onCancel={() => setCancelling(null)}
          onConfirm={() => cancel(cancelling)}
        />
      )}
    </section>
  )
}

function MissionKindLabel({ kind, mode }: { kind: MissionKind; mode: MatchMode | null }) {
  return (
    <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
      {kind === 'match_streak' ? (mode === 'online' ? '🌐 Misi match online' : '🃏 Misi match offline') : '⚔️ Misi duel'}
    </p>
  )
}

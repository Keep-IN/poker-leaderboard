import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useTheme, type ThemePref } from '../lib/theme'
import { cx } from './ui'

const tabs = [
  { to: '/', label: 'Beranda', icon: HomeIcon },
  { to: '/matches', label: 'Match', icon: CardsIcon },
  { to: '/players', label: 'Pemain', icon: PeopleIcon },
  { to: '/leaderboard', label: 'Leaderboard', icon: TrophyIcon },
]

export default function Layout() {
  const { profile, signOut } = useAuth()

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col md:max-w-5xl">
      <header className="safe-top sticky top-0 z-20 border-b border-ink/5 bg-surface-900/85 backdrop-blur">
        <div className="flex h-14 items-center justify-between gap-4 px-4 md:h-16 md:px-6">
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-xl text-brand-400">♠</span>
            <span className="font-bold tracking-tight">BTP Poker League</span>
            {profile?.role === 'dealer' && (
              <span className="rounded-md bg-brand-400/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-300">
                Dealer
              </span>
            )}
          </div>
          <nav className="hidden items-center gap-1 md:flex">
            {tabs.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  cx(
                    'flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition',
                    isActive ? 'bg-brand-400/10 text-brand-400' : 'text-slate-400 hover:bg-ink/5 hover:text-slate-200',
                  )
                }
              >
                <Icon className="size-5" />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="flex shrink-0 items-center gap-1">
            <ThemeButton />
            <button onClick={signOut} className="rounded-lg px-2 py-1 text-sm text-slate-400 hover:text-slate-100">
              Keluar
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 pt-4 pb-28 md:px-6 md:pt-8 md:pb-12">
        <Outlet />
      </main>

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-20 md:hidden border-t border-ink/5 bg-surface-950/90 backdrop-blur">
        <div className="mx-auto grid max-w-lg grid-cols-4">
          {tabs.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cx(
                  'flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition',
                  isActive ? 'text-brand-400' : 'text-slate-400 hover:text-slate-200',
                )
              }
            >
              <Icon />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}

const themeOrder: ThemePref[] = ['system', 'light', 'dark']
const themeLabels: Record<ThemePref, string> = { system: 'Ikut sistem', light: 'Terang', dark: 'Gelap' }

/** Cycles system → light → dark. The icon shows the current choice. */
function ThemeButton() {
  const { pref, choose } = useTheme()
  const next = themeOrder[(themeOrder.indexOf(pref) + 1) % themeOrder.length]
  return (
    <button
      onClick={() => choose(next)}
      title={`Tema: ${themeLabels[pref]} (ketuk untuk ${themeLabels[next].toLowerCase()})`}
      aria-label={`Tema: ${themeLabels[pref]}`}
      className="flex size-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-ink/5 hover:text-slate-100"
    >
      <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {pref === 'light' ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        ) : pref === 'dark' ? (
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
        ) : (
          <>
            <rect x="3" y="4" width="18" height="12" rx="2" />
            <path d="M8 20h8M12 16v4" />
          </>
        )}
      </svg>
    </button>
  )
}

function HomeIcon({ className = 'size-6' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" strokeLinejoin="round" />
    </svg>
  )
}

function CardsIcon({ className = 'size-6' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="5" width="11" height="15" rx="2" transform="rotate(-8 8.5 12.5)" />
      <rect x="10" y="4" width="11" height="15" rx="2" />
      <path d="M15.5 9.5c1 1.5 2.5 2.2 2.5 3.6a1.5 1.5 0 0 1-2.5 1.1V15h-1v-.8a1.5 1.5 0 0 1-2.5-1.1c0-1.4 1.5-2.1 2.5-3.6z" fill="currentColor" stroke="none" />
    </svg>
  )
}

function TrophyIcon({ className = 'size-6' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M9 17h6v4H9z" strokeLinejoin="round" />
    </svg>
  )
}

function PeopleIcon({ className = 'size-6' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.2a6.5 6.5 0 0 1 3.5 5.8" strokeLinecap="round" />
    </svg>
  )
}

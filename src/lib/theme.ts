import { useEffect, useState } from 'react'

export type ThemePref = 'system' | 'light' | 'dark'

const KEY = 'theme'
// Sama dengan skrip awal di index.html dan public/meja.html.
const BAR = { light: '#f3f6fb', dark: '#081530' }

export function readThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

const media = () => window.matchMedia('(prefers-color-scheme: dark)')

/** Writes data-theme on <html> from the saved choice, falling back to the device setting. */
export function applyTheme(pref: ThemePref = readThemePref()) {
  const mode = pref === 'system' ? (media().matches ? 'dark' : 'light') : pref
  document.documentElement.dataset.theme = mode
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BAR[mode])
}

/** The saved theme choice plus a setter; follows the device while the choice is "system". */
export function useTheme() {
  const [pref, setPref] = useState<ThemePref>(readThemePref)

  useEffect(() => {
    applyTheme(pref)
    if (pref !== 'system') return
    const m = media()
    const onChange = () => applyTheme('system')
    m.addEventListener('change', onChange)
    return () => m.removeEventListener('change', onChange)
  }, [pref])

  function choose(next: ThemePref) {
    try {
      if (next === 'system') localStorage.removeItem(KEY)
      else localStorage.setItem(KEY, next)
    } catch {
      // storage blocked: the choice still applies for this visit
    }
    setPref(next)
  }

  return { pref, choose }
}

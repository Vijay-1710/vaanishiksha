import { useEffect, useState } from 'react'

export type ThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'vaanishiksha_theme'

export function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function applyTheme(mode: ThemeMode) {
  if (typeof document === 'undefined') return
  const resolved = mode === 'system' ? getSystemTheme() : mode
  const root = document.documentElement
  if (resolved === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    if (typeof localStorage === 'undefined') return 'system'
    return (localStorage.getItem(STORAGE_KEY) as ThemeMode) || 'system'
  })

  useEffect(() => {
    applyTheme(theme)
    localStorage.setItem(STORAGE_KEY, theme)

    if (theme === 'system') {
      const media = window.matchMedia('(prefers-color-scheme: dark)')
      const listener = () => applyTheme('system')
      media.addEventListener('change', listener)
      return () => media.removeEventListener('change', listener)
    }
  }, [theme])

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme)
  }

  const isDark = theme === 'dark' || (theme === 'system' && getSystemTheme() === 'dark')

  return { theme, setTheme, isDark }
}

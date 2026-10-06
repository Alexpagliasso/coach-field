import { createContext, useContext } from 'react'

export type AppTheme = 'pitch' | 'electric' | 'purple' | 'ice' | 'light'

export const APP_THEMES: Array<{ id: AppTheme; name: string; description: string }> = [
  { id: 'pitch', name: 'Pitch', description: 'Campo · elegante' },
  { id: 'electric', name: 'Electric Blue', description: 'Tech · professionale' },
  { id: 'purple', name: 'Purple Data', description: 'Analytics · premium' },
  { id: 'ice', name: 'Ice Cyan', description: 'Fresco · moderno' },
  { id: 'light', name: 'Light', description: 'Chiaro · professionale' },
]

export const THEME_STORAGE_KEY = 'coach-field-theme'

export type ThemeContextValue = {
  theme: AppTheme
  setTheme: (theme: AppTheme) => void
}

export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

const themeIds = new Set<AppTheme>(APP_THEMES.map((theme) => theme.id))

export function readStoredTheme(): AppTheme {
  if (typeof window === 'undefined') return 'pitch'
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    return themeIds.has(stored as AppTheme) ? stored as AppTheme : 'pitch'
  } catch {
    return 'pitch'
  }
}

export function getThemeColor(theme: AppTheme) {
  if (theme === 'light') return '#f3f6f9'
  if (theme === 'electric') return '#090e18'
  if (theme === 'purple') return '#0e0b14'
  if (theme === 'ice') return '#071114'
  return '#070a0f'
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within ThemeProvider')
  return context
}

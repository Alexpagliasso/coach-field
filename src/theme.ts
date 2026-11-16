import { createContext, useContext } from 'react'

export type AppTheme = 'sage' | 'lavender' | 'sand' | 'midnight'
export const APP_THEMES: Array<{ id: AppTheme; name: string; description: string }> = [
  { id: 'sage', name: 'Sage', description: 'Avorio · salvia · bosco' },
  { id: 'lavender', name: 'Lavender', description: 'Perla · lavanda · ardesia' },
  { id: 'sand', name: 'Sand', description: 'Crema · pesca · terracotta' },
  { id: 'midnight', name: 'Midnight', description: 'Blu notte · pastelli desaturati' },
]
export const THEME_STORAGE_KEY = 'coach-field-theme'
export type ThemeContextValue = { theme: AppTheme; setTheme: (theme: AppTheme) => void }
export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)
const themeIds = new Set<AppTheme>(APP_THEMES.map(({ id }) => id))

export function readStoredTheme(): AppTheme {
  if (typeof window === 'undefined') return 'sage'
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (themeIds.has(stored as AppTheme)) return stored as AppTheme
    const legacy: Record<string, AppTheme> = { light: 'sage', pitch: 'midnight', electric: 'midnight', purple: 'lavender', ice: 'lavender' }
    return legacy[stored ?? ''] ?? 'sage'
  } catch { return 'sage' }
}

export function getThemeColor(theme: AppTheme) {
  if (theme === 'lavender') return '#f2f0f6'
  if (theme === 'sand') return '#f7f0e5'
  if (theme === 'midnight') return '#111827'
  return '#f4f1e8'
}
export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within ThemeProvider')
  return context
}

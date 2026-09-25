import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { getThemeColor, readStoredTheme, ThemeContext, THEME_STORAGE_KEY, type AppTheme, type ThemeContextValue } from './theme'

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>(() => readStoredTheme())
  useEffect(() => {
    const restored = () => setThemeState(readStoredTheme())
    window.addEventListener('local-data-restored', restored)
    return () => window.removeEventListener('local-data-restored', restored)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', getThemeColor(theme))
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
      // The selected theme is still applied for the current session.
    }
  }, [theme])

  const value = useMemo<ThemeContextValue>(() => ({
    theme,
    setTheme: setThemeState,
  }), [theme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

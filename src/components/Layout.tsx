import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { CalendarDays, Mic2, Palette, Trophy, Users } from 'lucide-react'
import { ThemeSelectorSheet } from './ThemeSelectorSheet'

const navItems = [
  { to: '/', label: 'Oggi', icon: CalendarDays },
  { to: '/players', label: 'Giocatori', icon: Users },
  { to: '/matches', label: 'Partite', icon: Trophy },
  { to: '/notes', label: 'Note', icon: Mic2 },
]

export function Layout() {
  const [themeOpen, setThemeOpen] = useState(false)

  return (
    <div className="app-shell">
      <button type="button" className="theme-trigger" onClick={() => setThemeOpen(true)} aria-label="Tema">
        <Palette size={21} aria-hidden="true" />
        <span>Tema</span>
      </button>
      <main className="app-main">
        <Outlet />
      </main>
      <nav className="bottom-nav" aria-label="Navigazione principale">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Icon aria-hidden="true" size={23} strokeWidth={2.4} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      {themeOpen && <ThemeSelectorSheet onClose={() => setThemeOpen(false)} />}
    </div>
  )
}

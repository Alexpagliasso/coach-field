import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { NavLink } from '../groups/navigation'
import { CalendarDays, Mic2, Palette, Trophy, Users } from 'lucide-react'
import { ThemeSelectorSheet } from './ThemeSelectorSheet'
import { Link } from '../groups/navigation'
import { useGroup, usePermissions } from '../groups/groupContext'
import { useAuth } from '../auth/authContext'

const navItems = [
  { to: '/', label: 'Oggi', icon: CalendarDays },
  { to: '/players', label: 'Giocatori', icon: Users },
  { to: '/matches', label: 'Partite', icon: Trophy },
  { to: '/notes', label: 'Note', icon: Mic2 },
]

export function Layout() {
  const [themeOpen, setThemeOpen] = useState(false)
  const { activeGroup } = useGroup()
  const { role, can } = usePermissions()
  const { signOut } = useAuth()

  return (
    <div className="app-shell">
      <header className="private-topbar"><strong>{activeGroup?.name}</strong><span>{role === 'admin' ? 'Amministratore' : role === 'coach' ? 'Allenatore' : 'Collaboratore'}</span><Link to="/app/groups">Cambia gruppo</Link>{can('staff.view') && <Link to={`/app/${activeGroup?.id}/staff`}>Staff</Link>}<button onClick={() => void signOut()}>Esci</button></header>
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

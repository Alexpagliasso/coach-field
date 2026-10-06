import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { NavLink } from '../groups/navigation'
import { CalendarDays, LogOut, Mic2, Palette, Repeat2, Trophy, UserCog, Users } from 'lucide-react'
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
      <header className="private-topbar">
        <div className="min-w-0 flex-1"><span className="block text-[11px] font-bold uppercase tracking-widest text-app-muted">Gruppo attivo</span><strong className="block truncate text-base">{activeGroup?.name}</strong></div>
        <span className="rounded-full border border-app-primary/40 bg-app-primary/10 px-2.5 py-1 text-xs font-bold text-app-primary">{role === 'admin' ? 'Amministratore' : role === 'coach' ? 'Allenatore' : 'Collaboratore'}</span>
        <Link to="/app/groups"><Repeat2 size={16} /> Cambia gruppo</Link>{can('staff.view') && <Link to={`/app/${activeGroup?.id}/staff`}><UserCog size={16} /> Staff</Link>}<button onClick={() => void signOut()}><LogOut size={16} /> Esci</button>
        <button type="button" className="theme-trigger" onClick={() => setThemeOpen(true)} aria-label="Tema">
          <Palette size={21} aria-hidden="true" />
          <span>Tema</span>
        </button>
      </header>
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

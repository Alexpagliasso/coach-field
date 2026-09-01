import { NavLink, Outlet } from 'react-router-dom'
import { CalendarDays, Mic2, Shield, Users } from 'lucide-react'

const navItems = [
  { to: '/', label: 'Oggi', icon: CalendarDays },
  { to: '/players', label: 'Giocatori', icon: Users },
  { to: '/goalkeepers', label: 'Portieri', icon: Shield },
  { to: '/notes', label: 'Note', icon: Mic2 },
]

export function Layout() {
  return (
    <div className="app-shell">
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
    </div>
  )
}

import { useEffect, useState, type ComponentType } from 'react'
import { Outlet, useLocation, useNavigate as useRouterNavigate } from 'react-router-dom'
import {
  BarChart3, CalendarDays, ChevronDown, ChevronRight, ClipboardList, Dumbbell,
  Home, LogOut, Menu, Palette, PanelLeftClose, PanelLeftOpen, Repeat2, Settings, Trophy, Users, X,
} from 'lucide-react'
import { NavLink, Link } from '../groups/navigation'
import { ThemeSelectorSheet } from './ThemeSelectorSheet'
import { useGroup, usePermissions } from '../groups/groupContext'
import { useAuth } from '../auth/authContext'
import { APP_NAME } from '../brand'
import { resolveGroupHierarchy } from '../groups/hierarchyNavigation'

type NavItem = { to: string; label: string; icon: ComponentType<{ size?: number; className?: string }> }

const overview: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: BarChart3 },
  { to: '/today', label: 'Oggi', icon: Home },
  { to: '/calendar', label: 'Calendario', icon: CalendarDays },
]
const activities: NavItem[] = [
  { to: '/training', label: 'Allenamenti', icon: Dumbbell },
  { to: '/exercises', label: 'Libreria esercizi', icon: ClipboardList },
  { to: '/matches', label: 'Partite', icon: Trophy },
]
const squad: NavItem[] = [
  { to: '/players', label: 'Giocatori', icon: Users },
]

function SideNavSection({ label, items, collapsed }: { label: string; items: NavItem[]; collapsed: boolean }) {
  return <section className="app-nav-section"><span>{label}</span>{items.map(({ to, label: itemLabel, icon: Icon }) => <NavLink key={to} to={to} title={collapsed ? itemLabel : undefined} aria-label={collapsed ? itemLabel : undefined} className={({ isActive }) => `app-nav-link ${isActive ? 'active' : ''}`}><Icon size={18} /><b>{itemLabel}</b></NavLink>)}</section>
}

function MobileMenu({ kind, categoryPath, categoryName, onClose }: { kind: 'activity' | 'more'; categoryPath?: string; categoryName?: string; onClose: () => void }) {
  const { can } = usePermissions()
  const items: NavItem[] = kind === 'activity' ? activities : [
    ...overview.slice(0, 1),
    ...squad.slice(1),
    ...(can('staff.view') ? [{ to: '/staff', label: 'Staff', icon: Users }] : []),
    ...(can('group.settings') ? [{ to: '/settings', label: 'Impostazioni', icon: Settings }] : []),
  ]
  return <div className="mobile-nav-overlay" role="presentation" onClick={onClose}><section className="mobile-nav-sheet" role="dialog" aria-modal="true" aria-label={kind === 'activity' ? 'Attività' : 'Altre destinazioni'} onClick={event => event.stopPropagation()}><div className="mobile-nav-sheet-head"><div><span className="eyebrow">Navigazione</span><h2>{kind === 'activity' ? 'Attività' : 'Altro'}</h2></div><button type="button" onClick={onClose} aria-label="Chiudi menu"><X size={21} /></button></div><div className="mobile-nav-grid">{items.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} onClick={onClose} className={({ isActive }) => `mobile-nav-destination ${isActive ? 'active' : ''}`}><Icon size={21} /><span>{label}</span><ChevronRight size={17} /></NavLink>)}</div>{categoryPath && <Link to={categoryPath} onClick={onClose} className="mobile-category-return"><Repeat2 size={19} /><span><small>Torna alla categoria</small><strong>{categoryName}</strong></span><ChevronRight size={18} /></Link>}</section></div>
}

export function Layout() {
  const [themeOpen, setThemeOpen] = useState(false)
  const [mobileMenu, setMobileMenu] = useState<'activity' | 'more'>()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('growpitch:sidebar-collapsed') === 'true')
  const { activeGroup, data, availableGroups, switchGroup } = useGroup()
  const { can, isDemoViewer } = usePermissions()
  const { signOut, profile } = useAuth()
  const location = useLocation()
  const navigate = useRouterNavigate()
  useEffect(() => setMobileMenu(undefined), [location.pathname])
  useEffect(() => localStorage.setItem('growpitch:sidebar-collapsed', String(sidebarCollapsed)), [sidebarCollapsed])

  const { organization, team, season, organizationPath, seasonPath, categoryPath } = resolveGroupHierarchy(data, activeGroup)
  const activityActive = /\/(training|matches)(\/|$)/.test(location.pathname)
  const moreActive = /\/(dashboard|staff|settings)(\/|$)/.test(location.pathname)
  const groupsInActiveOrganization = activeGroup ? availableGroups.filter(group => group.organizationId === activeGroup.organizationId) : []
  const groupLabel = (group: typeof availableGroups[number]) => {
    const groupTeam = data.teams.find(teamItem => teamItem.id === group.teamId)
    const groupSeason = data.organizationSeasons.find(seasonItem => seasonItem.id === groupTeam?.seasonId)
    return [group.name, groupTeam?.name, groupSeason?.name].filter(Boolean).join(' · ')
  }

  return <div className={`app-command-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
    <aside className={`app-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`} aria-label="Navigazione workspace">
      <div className="app-sidebar-brand-row"><Link to="/app/groups" className="app-brand"><span>GP</span><strong>{APP_NAME}</strong></Link><button type="button" className="app-sidebar-toggle" onClick={() => setSidebarCollapsed(value => !value)} aria-label={sidebarCollapsed ? 'Espandi navigazione' : 'Riduci navigazione'} title={sidebarCollapsed ? 'Espandi navigazione' : 'Riduci navigazione'}>{sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}</button></div>
      <label className="context-switcher"><span>WorkGroup attivo</span><div><select value={activeGroup?.id ?? ''} onChange={event => event.target.value && event.target.value !== activeGroup?.id && switchGroup(event.target.value)} aria-label="Cambia WorkGroup">{groupsInActiveOrganization.map(group => <option key={group.id} value={group.id}>{groupLabel(group)}</option>)}</select><ChevronDown size={16} /></div><small>{team?.name ?? organization?.name ?? 'Contesto operativo'}</small>{isDemoViewer && <BadgeDemo />}</label>
      <nav className="app-sidebar-nav"><SideNavSection label="Overview" items={overview} collapsed={sidebarCollapsed} /><SideNavSection label="Attività" items={activities} collapsed={sidebarCollapsed} /><SideNavSection label="Squadra" items={squad} collapsed={sidebarCollapsed} /><section className="app-nav-section"><span>Gestione</span>{can('staff.view') && <NavLink to="/staff" title={sidebarCollapsed ? 'Staff' : undefined} aria-label={sidebarCollapsed ? 'Staff' : undefined} className={({ isActive }) => `app-nav-link ${isActive ? 'active' : ''}`}><Users size={18} /><b>Staff</b></NavLink>}{can('group.settings') && <NavLink to="/settings" title={sidebarCollapsed ? 'Impostazioni' : undefined} aria-label={sidebarCollapsed ? 'Impostazioni' : undefined} className={({ isActive }) => `app-nav-link ${isActive ? 'active' : ''}`}><Settings size={18} /><b>Impostazioni</b></NavLink>}{categoryPath && <Link to={categoryPath} title={sidebarCollapsed ? 'Torna alla categoria' : undefined} aria-label={sidebarCollapsed ? 'Torna alla categoria' : undefined} className="app-nav-link"><Repeat2 size={18} /><b>Torna alla categoria</b></Link>}</section></nav>
      <div className="app-sidebar-footer"><button type="button" onClick={() => setThemeOpen(true)}><Palette size={18} /><span>Tema</span></button><button type="button" onClick={() => void signOut()}><LogOut size={18} /><span>Esci</span></button><small>{profile?.email}</small></div>
    </aside>

    <div className="app-workspace">
      <header className="app-context-header"><div className="app-mobile-brand"><span>GP</span><strong>{APP_NAME}</strong></div><nav className="app-breadcrumbs" aria-label="Percorso"><Link to="/app/groups">Società</Link>{organization && <><ChevronRight /><Link to={organizationPath!}>{organization.name}</Link></>}{season && seasonPath && <><ChevronRight /><Link to={seasonPath}>{season.name}</Link></>}{team && categoryPath && <><ChevronRight /><Link to={categoryPath}>{team.name}</Link></>}{activeGroup && <><ChevronRight /><strong>{activeGroup.name}</strong></>}</nav><div className="app-header-actions">{isDemoViewer && <BadgeDemo compact />}<button type="button" onClick={() => setThemeOpen(true)} aria-label="Cambia tema"><Palette size={18} /></button><button type="button" onClick={() => navigate('/app/groups')} aria-label="Cambia contesto"><Repeat2 size={18} /></button></div></header>
      <main className="app-main app-command-main"><Outlet /></main>
    </div>

    <nav className="mobile-command-nav" aria-label="Navigazione principale"><NavLink to="/today" className={({ isActive }) => isActive ? 'active' : ''}><Home /><span>Oggi</span></NavLink><NavLink to="/calendar" className={({ isActive }) => isActive ? 'active' : ''}><CalendarDays /><span>Calendario</span></NavLink><NavLink to="/players" className={({ isActive }) => isActive ? 'active' : ''}><Users /><span>Rosa</span></NavLink><button type="button" className={activityActive ? 'active' : ''} onClick={() => setMobileMenu('activity')} aria-expanded={mobileMenu === 'activity'}><ClipboardList /><span>Attività</span></button><button type="button" className={moreActive ? 'active' : ''} onClick={() => setMobileMenu('more')} aria-expanded={mobileMenu === 'more'}><Menu /><span>Altro</span></button></nav>
    {mobileMenu && <MobileMenu kind={mobileMenu} categoryPath={categoryPath} categoryName={team?.name} onClose={() => setMobileMenu(undefined)} />}
    {themeOpen && <ThemeSelectorSheet onClose={() => setThemeOpen(false)} />}
  </div>
}

function BadgeDemo({ compact = false }: { compact?: boolean }) { return <span className={`inline-flex items-center rounded-full border border-app-primary/30 bg-app-primary/10 px-2 py-1 text-xs font-bold text-app-primary ${compact ? 'whitespace-nowrap' : 'mt-2 w-fit'}`}>Demo · Sola lettura</span> }

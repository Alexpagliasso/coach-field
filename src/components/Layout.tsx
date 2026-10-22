import { useEffect, useRef, useState, type ComponentType } from 'react'
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
import type { Group } from '../types/staff'

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
    ...(can('group.settings') ? [{ to: '/settings', label: 'Impostazioni', icon: Settings }] : []),
  ]
  return <div className="mobile-nav-overlay" role="presentation" onClick={onClose}><section className="mobile-nav-sheet" role="dialog" aria-modal="true" aria-label={kind === 'activity' ? 'Attività' : 'Altre destinazioni'} onClick={event => event.stopPropagation()}><div className="mobile-nav-sheet-head"><div><span className="eyebrow">Navigazione</span><h2>{kind === 'activity' ? 'Attività' : 'Altro'}</h2></div><button type="button" onClick={onClose} aria-label="Chiudi menu"><X size={21} /></button></div><div className="mobile-nav-grid">{items.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} onClick={onClose} className={({ isActive }) => `mobile-nav-destination ${isActive ? 'active' : ''}`}><Icon size={21} /><span>{label}</span><ChevronRight size={17} /></NavLink>)}</div>{categoryPath && <Link to={categoryPath} onClick={onClose} className="mobile-category-return"><Repeat2 size={19} /><span><small>Torna alla categoria</small><strong>{categoryName}</strong></span><ChevronRight size={18} /></Link>}</section></div>
}

function WorkGroupSwitcher({ activeGroup, groups, details, onSelect }: { activeGroup?: Group; groups: Group[]; details: (group: Group) => string; onSelect: (id: string) => void }) {
  const [open, setOpen] = useState(false); const [focusIndex, setFocusIndex] = useState(0)
  const root = useRef<HTMLDivElement>(null); const options = useRef<Array<HTMLButtonElement | null>>([])
  const activeIndex = Math.max(0, groups.findIndex(group => group.id === activeGroup?.id))
  useEffect(() => { const close = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }; document.addEventListener('mousedown', close); return () => document.removeEventListener('mousedown', close) }, [])
  const openAt = (index = activeIndex) => { setFocusIndex(index); setOpen(true); window.setTimeout(() => options.current[index]?.focus(), 0) }
  const keyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === 'Escape') { event.preventDefault(); setOpen(false); return }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
      event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? groups.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + groups.length) % groups.length
      setFocusIndex(next); options.current[next]?.focus()
    }
  }
  return <div className="workgroup-switcher" ref={root}><button type="button" className="workgroup-switcher-trigger" aria-haspopup="listbox" aria-expanded={open} onClick={() => open ? setOpen(false) : openAt()} onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); openAt() } }}><span><strong>{activeGroup?.name ?? 'Scegli WorkGroup'}</strong><small>{activeGroup ? details(activeGroup) : ''}</small></span><ChevronDown size={17} /></button>{open && <div className="workgroup-switcher-menu" role="listbox" aria-label="Cambia WorkGroup">{groups.map((group, index) => <button key={group.id} ref={element => { options.current[index] = element }} type="button" role="option" aria-selected={group.id === activeGroup?.id} tabIndex={index === focusIndex ? 0 : -1} onKeyDown={event => keyDown(event, index)} onClick={() => { setOpen(false); if (group.id !== activeGroup?.id) onSelect(group.id) }}><strong>{group.name}</strong><small>{details(group)}</small></button>)}</div>}</div>
}

export function Layout() {
  const [themeOpen, setThemeOpen] = useState(false)
  const [mobileMenu, setMobileMenu] = useState<'activity' | 'more'>()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('growpitch:sidebar-collapsed') === 'true')
  const [online, setOnline] = useState(() => navigator.onLine)
  const { activeGroup, data, availableGroups, switchGroup } = useGroup()
  const { can, isDemoViewer } = usePermissions()
  const { signOut, profile } = useAuth()
  const location = useLocation()
  const navigate = useRouterNavigate()
  useEffect(() => setMobileMenu(undefined), [location.pathname])
  useEffect(() => localStorage.setItem('growpitch:sidebar-collapsed', String(sidebarCollapsed)), [sidebarCollapsed])
  useEffect(() => {
    const updateConnection = () => setOnline(navigator.onLine)
    window.addEventListener('online', updateConnection)
    window.addEventListener('offline', updateConnection)
    return () => { window.removeEventListener('online', updateConnection); window.removeEventListener('offline', updateConnection) }
  }, [])

  const { organization, team, season, organizationPath, seasonPath, categoryPath } = resolveGroupHierarchy(data, activeGroup)
  const activityActive = /\/(training|matches)(\/|$)/.test(location.pathname)
  const moreActive = /\/(dashboard|staff|settings)(\/|$)/.test(location.pathname)
  const groupsInActiveOrganization = activeGroup ? availableGroups.filter(group => group.organizationId === activeGroup.organizationId) : []
  const groupLabel = (group: typeof availableGroups[number]) => {
    const groupTeam = data.teams.find(teamItem => teamItem.id === group.teamId)
    const groupSeason = data.organizationSeasons.find(seasonItem => seasonItem.id === groupTeam?.seasonId)
    return [group.name, groupTeam?.name, groupSeason?.name].filter(Boolean).join(' · ')
  }
  const groupDetails = (group: typeof availableGroups[number]) => groupLabel(group).split(' · ').slice(1).join(' · ') || 'WorkGroup'

  return <div className={`app-command-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
    <aside className={`app-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`} aria-label="Navigazione workspace">
      <div className="app-sidebar-brand-row"><Link to="/app/groups" className="app-brand"><span>GP</span><strong>{APP_NAME}</strong></Link><button type="button" className="app-sidebar-toggle" onClick={() => setSidebarCollapsed(value => !value)} aria-label={sidebarCollapsed ? 'Espandi navigazione' : 'Riduci navigazione'} title={sidebarCollapsed ? 'Espandi navigazione' : 'Riduci navigazione'}>{sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}</button></div>
      <section className="context-switcher"><span>WorkGroup attivo</span><WorkGroupSwitcher activeGroup={activeGroup} groups={groupsInActiveOrganization} details={groupDetails} onSelect={switchGroup} /><small>{team?.name ?? organization?.name ?? 'Contesto operativo'}</small>{isDemoViewer && <BadgeDemo />}</section>
      <nav className="app-sidebar-nav"><SideNavSection label="Overview" items={overview} collapsed={sidebarCollapsed} /><SideNavSection label="Attività" items={activities} collapsed={sidebarCollapsed} /><SideNavSection label="Squadra" items={squad} collapsed={sidebarCollapsed} /><section className="app-nav-section"><span>Gestione</span><span className="app-nav-link app-nav-link-disabled" aria-disabled="true" title="Staff: prossimamente"><Users size={18} /><span><b>Staff</b><small>Prossimamente</small></span></span>{can('group.settings') && <NavLink to="/settings" title={sidebarCollapsed ? 'Impostazioni' : undefined} aria-label={sidebarCollapsed ? 'Impostazioni' : undefined} className={({ isActive }) => `app-nav-link ${isActive ? 'active' : ''}`}><Settings size={18} /><b>Impostazioni</b></NavLink>}{categoryPath && <Link to={categoryPath} title={sidebarCollapsed ? 'Torna alla categoria' : undefined} aria-label={sidebarCollapsed ? 'Torna alla categoria' : undefined} className="app-nav-link"><Repeat2 size={18} /><b>Torna alla categoria</b></Link>}</section></nav>
      <div className="app-sidebar-footer"><button type="button" onClick={() => setThemeOpen(true)}><Palette size={18} /><span>Tema</span></button><button type="button" onClick={() => void signOut()}><LogOut size={18} /><span>Esci</span></button><small>{profile?.email}</small></div>
    </aside>

    <div className="app-workspace">
      {!online && <div className="offline-notice" role="status"><strong>Sei offline.</strong> Puoi consultare l’app già caricata; dati cloud, accesso e salvataggi potrebbero non essere disponibili.</div>}
      <header className="app-context-header"><div className="app-mobile-brand"><span>GP</span><strong>{APP_NAME}</strong></div><nav className="app-breadcrumbs" aria-label="Percorso"><Link to="/app/groups">Società</Link>{organization && <><ChevronRight /><Link to={organizationPath!}>{organization.name}</Link></>}{season && seasonPath && <><ChevronRight /><Link to={seasonPath}>{season.name}</Link></>}{team && categoryPath && <><ChevronRight /><Link to={categoryPath}>{team.name}</Link></>}{activeGroup && <><ChevronRight /><strong>{activeGroup.name}</strong></>}</nav><div className="app-header-actions">{isDemoViewer && <BadgeDemo compact />}<button type="button" onClick={() => setThemeOpen(true)} aria-label="Cambia tema"><Palette size={18} /></button><button type="button" onClick={() => navigate('/app/groups')} aria-label="Cambia contesto"><Repeat2 size={18} /></button></div></header>
      <main className="app-main app-command-main"><Outlet /></main>
    </div>

    <nav className="mobile-command-nav" aria-label="Navigazione principale"><NavLink to="/today" className={({ isActive }) => isActive ? 'active' : ''}><Home /><span>Oggi</span></NavLink><NavLink to="/calendar" className={({ isActive }) => isActive ? 'active' : ''}><CalendarDays /><span>Calendario</span></NavLink><NavLink to="/players" className={({ isActive }) => isActive ? 'active' : ''}><Users /><span>Rosa</span></NavLink><button type="button" className={activityActive ? 'active' : ''} onClick={() => setMobileMenu('activity')} aria-expanded={mobileMenu === 'activity'}><ClipboardList /><span>Attività</span></button><button type="button" className={moreActive ? 'active' : ''} onClick={() => setMobileMenu('more')} aria-expanded={mobileMenu === 'more'}><Menu /><span>Altro</span></button></nav>
    {mobileMenu && <MobileMenu kind={mobileMenu} categoryPath={categoryPath} categoryName={team?.name} onClose={() => setMobileMenu(undefined)} />}
    {themeOpen && <ThemeSelectorSheet onClose={() => setThemeOpen(false)} />}
  </div>
}

function BadgeDemo({ compact = false }: { compact?: boolean }) { return <span className={`inline-flex items-center rounded-full border border-app-primary/30 bg-app-primary/10 px-2 py-1 text-xs font-bold text-app-primary ${compact ? 'whitespace-nowrap' : 'mt-2 w-fit'}`}>Demo · Sola lettura</span> }

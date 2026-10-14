import { useState, type ReactNode } from 'react'
import { LogOut, Palette } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Outlet } from 'react-router-dom'
import { APP_NAME } from '../brand'
import { useAuth } from '../auth/authContext'
import { ThemeSelectorSheet } from './ThemeSelectorSheet'
import { Button, ErrorState, LoadingState } from './ui'
import { useGroup } from '../groups/groupContext'

export function HierarchyShell({ children }: { children?: ReactNode }) {
  const [themeOpen, setThemeOpen] = useState(false)
  const { profile, signOut } = useAuth()
  const { loading, error, reload } = useGroup()
  return <div className="hierarchy-shell"><header className="hierarchy-topbar"><Link to="/app/groups" className="app-brand"><span>GP</span><strong>{APP_NAME}</strong></Link><div><small>{profile?.email}</small><button type="button" onClick={() => setThemeOpen(true)} aria-label="Cambia tema"><Palette size={18} /></button><button type="button" onClick={() => void signOut()} aria-label="Esci"><LogOut size={18} /></button></div></header>{loading ? <main className="gp-hub"><LoadingState label="Preparazione del command center…" /></main> : error ? <main className="gp-hub"><ErrorState message={error} action={<Button onClick={() => void reload()}>Riprova</Button>} /></main> : children ?? <Outlet />}{themeOpen && <ThemeSelectorSheet onClose={() => setThemeOpen(false)} />}</div>
}

import { useEffect, useState } from 'react'
import { UserPlus, Users } from 'lucide-react'
import { assignStaff, listRows, setPermission, updateMembership } from '../cloud/staffRepository'
import { NON_DELEGABLE, PERMISSIONS, resolvePermissions, type Permission } from '../auth/permissions'
import { useGroup, usePermissions } from '../groups/groupContext'
import { errorMessage } from '../lib/supabase'
import type { Group, UserProfile } from '../types/staff'
import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, Select } from '../components/ui'

const permissionLabels: Record<Permission, string> = {
  'players.view': 'Vedere giocatori', 'players.create': 'Creare giocatori', 'players.edit': 'Modificare giocatori', 'attendance.view': 'Vedere presenze', 'attendance.edit': 'Modificare presenze',
  'training.view': 'Vedere allenamenti', 'training.create': 'Creare allenamenti', 'training.edit': 'Modificare allenamenti', 'training.evaluate': 'Valutare allenamenti',
  'matches.view': 'Vedere partite', 'matches.create': 'Creare partite', 'matches.edit': 'Modificare partite', 'matches.evaluate': 'Valutare partite',
  'development.view': 'Vedere sviluppo', 'development.edit': 'Modificare sviluppo', 'templates.view': 'Vedere modelli', 'templates.edit': 'Modificare modelli',
  'notes.view': 'Vedere note', 'notes.create': 'Creare note', 'notes.delete': 'Eliminare note', 'staff.view': 'Vedere staff', 'staff.manage': 'Gestire staff', 'group.settings': 'Impostazioni gruppo', 'data.manage': 'Gestire dati',
}
const delegable = PERMISSIONS.filter(permission => !NON_DELEGABLE.includes(permission))

export function StaffPage({ group: supplied }: { group?: Group }) {
  const { activeGroup, data, reload } = useGroup()
  const { can, isAdmin } = usePermissions()
  const group = supplied ?? activeGroup
  const manage = Boolean(supplied) || can('staff.manage')
  const admin = Boolean(supplied) || isAdmin
  const [profiles, setProfiles] = useState<UserProfile[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { let alive = true; listRows<UserProfile>('profiles').then(rows => { if (alive) setProfiles(rows) }).catch(reason => { if (alive) setError(errorMessage(reason)) }); return () => { alive = false } }, [])
  if (!group) return null
  const run = async (operation: () => Promise<void>) => { setBusy(true); setError(''); try { await operation(); await reload() } catch (reason) { setError(errorMessage(reason)) } finally { setBusy(false) } }
  const members = data.memberships.filter(item => item.groupId === group.id)
  return <section className="grid gap-6"><div><p className="text-xs font-bold uppercase tracking-widest text-app-primary">{group.name}</p><h2 className="mt-1 text-2xl font-bold">Staff del gruppo</h2></div>{error && <ErrorState message={error} />}
    {manage && <Card><h3 className="mb-4 flex items-center gap-2 text-lg font-bold"><UserPlus size={20} /> Assegna una persona</h3><form className="grid gap-4 sm:grid-cols-[1fr_220px_auto] sm:items-end" onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); void run(() => assignStaff(group, String(form.get('email')), form.get('role') === 'coach' && admin ? 'coach' : 'collaborator')) }}><Field label="Email staff già registrato"><Input type="email" name="email" required /></Field><Field label="Ruolo"><Select name="role"><option value="collaborator">Collaboratore</option>{admin && <option value="coach">Allenatore</option>}</Select></Field><Button variant="primary" loading={busy}>Assegna staff</Button></form></Card>}
    {members.length === 0 && <EmptyState icon={Users} title="Staff ancora vuoto" description="Assegna una persona già registrata usando il suo indirizzo email." />}
    {(['coach', 'collaborator'] as const).map(role => { const roleMembers = members.filter(item => item.role === role); if (!roleMembers.length) return null; return <section key={role}><h3 className="mb-3 text-lg font-bold">{role === 'coach' ? 'Allenatori' : 'Collaboratori'}</h3><div className="grid gap-4">{roleMembers.map(member => { const profile = profiles.find(item => item.id === member.userId); const effective = resolvePermissions({ role: member.role, overrides: data.overrides.filter(item => item.membershipId === member.id) }); return <Card key={member.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><strong className="block">{profile ? `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim() || profile.email : member.userId}</strong>{profile?.email && <span className="text-sm text-app-muted">{profile.email}</span>}</div><Badge variant={member.active ? 'success' : 'danger'}>{member.active ? 'Attivo' : 'Disattivato'}</Badge></div>{manage && (admin || role === 'collaborator') && <Button className="mt-4" size="sm" variant={member.active ? 'danger' : 'success'} disabled={busy} onClick={() => void run(() => updateMembership(member.id, !member.active))}>{member.active ? 'Disattiva' : 'Riattiva'}</Button>}{manage && role === 'collaborator' && <details className="mt-4 rounded-xl border border-app-border bg-app-elevated p-3"><summary className="cursor-pointer font-semibold">Gestisci permessi</summary><div className="mt-4 grid gap-2 sm:grid-cols-2">{delegable.map(permission => <label className="flex min-h-11 items-center gap-3 rounded-lg px-2 text-sm hover:bg-app-surface" key={permission}><input className="size-5 accent-[var(--primary)]" type="checkbox" checked={effective[permission]} disabled={busy} onChange={event => void run(() => setPermission(member.id, permission, event.target.checked))} />{permissionLabels[permission]}</label>)}</div></details>}</Card> })}</div></section> })}
  </section>
}

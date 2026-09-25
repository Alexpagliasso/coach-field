import { useEffect, useState } from 'react'
import { assignStaff, listRows, setPermission, updateMembership } from '../cloud/staffRepository'
import { NON_DELEGABLE, PERMISSIONS, resolvePermissions } from '../auth/permissions'
import { useGroup, usePermissions } from '../groups/groupContext'
import { errorMessage } from '../lib/supabase'
import type { Group, UserProfile } from '../types/staff'
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
  return <section className="page"><h1>Staff · {group.name}</h1>{error && <p role="alert">{error}</p>}
    {manage && <form onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); void run(() => assignStaff(group, String(form.get('email')), form.get('role') === 'coach' && admin ? 'coach' : 'collaborator')) }}>
      <label className="form-field">Email staff già registrato<input type="email" name="email" required /></label>
      <label className="form-field">Ruolo<select name="role"><option value="collaborator">Collaboratore</option>{admin && <option value="coach">Allenatore</option>}</select></label>
      <button disabled={busy}>Assegna staff</button>
    </form>}
    {(['coach', 'collaborator'] as const).map(role => <section key={role}><h2>{role === 'coach' ? 'Allenatori' : 'Collaboratori'}</h2>
      {data.memberships.filter(item => item.groupId === group.id && item.role === role).map(member => {
        const profile = profiles.find(item => item.id === member.userId)
        const effective = resolvePermissions({ role: member.role, overrides: data.overrides.filter(item => item.membershipId === member.id) })
        return <article className="content-section" key={member.id}><strong>{profile ? `${profile.firstName ?? ''} ${profile.lastName ?? ''} ${profile.email}` : member.userId}</strong><p>{member.active ? 'Attivo' : 'Disattivato'}</p>
          {manage && (admin || role === 'collaborator') && <button disabled={busy} onClick={() => void run(() => updateMembership(member.id, !member.active))}>{member.active ? 'Disattiva' : 'Riattiva'}</button>}
          {manage && role === 'collaborator' && <details><summary>Gestisci permessi</summary>{PERMISSIONS.filter(permission => !NON_DELEGABLE.includes(permission)).map(permission => <label className="permission-row" key={permission}><input type="checkbox" checked={effective[permission]} disabled={busy} onChange={event => void run(() => setPermission(member.id, permission, event.target.checked))} />{permission}</label>)}</details>}
        </article>
      })}
    </section>)}
  </section>
}

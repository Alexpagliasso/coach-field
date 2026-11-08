import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link2, Pencil, Plus, Trash2, Unlink, UserRound, X } from 'lucide-react'
import { createStaffAccountLinkInvitation, deleteOrganizationStaffGroupAssignment, listOrganizationStaffGroupAssignments, listOrganizationStaffPeople, revokeStaffAccountLink, saveOrganizationStaffGroupAssignment, saveOrganizationStaffPerson } from '../cloud/staffRepository'
import { errorMessage } from '../lib/supabase'
import type { Group, OrganizationStaffGroupAssignment, OrganizationStaffPerson } from '../types/staff'
import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, LoadingState, Select } from './ui'

type Props = { organizationId: string; organizationName: string; groups: Group[] }
type AssignmentEditor = { person: OrganizationStaffPerson; assignment?: OrganizationStaffGroupAssignment }

export function OrganizationStaffDirectory({ organizationId, organizationName, groups }: Props) {
  const [people, setPeople] = useState<OrganizationStaffPerson[]>([])
  const [assignments, setAssignments] = useState<OrganizationStaffGroupAssignment[]>([])
  const [editor, setEditor] = useState<OrganizationStaffPerson | true>()
  const [assignmentEditor, setAssignmentEditor] = useState<AssignmentEditor>()
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false)
  const [error, setError] = useState(''), [notice, setNotice] = useState('')
  const [inviteUrl, setInviteUrl] = useState('')
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { const [nextPeople, nextAssignments] = await Promise.all([listOrganizationStaffPeople(organizationId), listOrganizationStaffGroupAssignments(organizationId)]); setPeople(nextPeople); setAssignments(nextAssignments) }
    catch (reason) { setError(`${errorMessage(reason)} Verifica che le migration 030 e 031 siano state applicate.`) }
    finally { setLoading(false) }
  }, [organizationId])
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer) }, [load])

  const savePerson = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!editor || busy) return
    const form = new FormData(event.currentTarget), firstName = String(form.get('firstName')).trim(), lastName = String(form.get('lastName')).trim(), intendedRole = form.get('intendedRole') === 'coach' ? 'coach' : 'collaborator'
    if (!firstName || !lastName) { setError('Nome e cognome sono obbligatori.'); return }
    setBusy(true); setError(''); setNotice('')
    try { await saveOrganizationStaffPerson({ id: editor === true ? undefined : editor.id, organizationId, firstName, lastName, intendedRole }); setEditor(undefined); setNotice(editor === true ? 'Persona registrata nello staff.' : 'Anagrafica staff aggiornata.'); await load() }
    catch (reason) { setError(errorMessage(reason)) } finally { setBusy(false) }
  }
  const saveAssignment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!assignmentEditor || busy) return
    const form = new FormData(event.currentTarget), groupId = String(form.get('groupId')), intendedRole = form.get('intendedRole') === 'coach' ? 'coach' : 'collaborator'
    if (!groupId) { setError('Seleziona un WorkGroup.'); return }
    setBusy(true); setError(''); setNotice('')
    try { await saveOrganizationStaffGroupAssignment({ id: assignmentEditor.assignment?.id, organizationId, staffPersonId: assignmentEditor.person.id, groupId, intendedRole }); setAssignmentEditor(undefined); setNotice(assignmentEditor.assignment ? 'Assegnazione aggiornata.' : 'Assegnazione prevista aggiunta.'); await load() }
    catch (reason) { setError(errorMessage(reason)) } finally { setBusy(false) }
  }
  const removeAssignment = async (person: OrganizationStaffPerson, assignment: OrganizationStaffGroupAssignment) => {
    const group = groups.find(item => item.id === assignment.groupId)
    if (!window.confirm(`Rimuovere l’assegnazione di ${person.firstName} ${person.lastName} da ${group?.name ?? 'questo gruppo'}?`)) return
    setBusy(true); setError(''); setNotice('')
    try { await deleteOrganizationStaffGroupAssignment({ id: assignment.id, organizationId, staffPersonId: person.id }); setNotice('Assegnazione rimossa.'); await load() }
    catch (reason) { setError(errorMessage(reason)) } finally { setBusy(false) }
  }
  const createLink = async (person: OrganizationStaffPerson) => {
    setBusy(true); setError(''); setNotice(''); setInviteUrl('')
    try { const token = await createStaffAccountLinkInvitation(organizationId, person.id); setInviteUrl(`${window.location.origin}/app/staff-link?token=${encodeURIComponent(token)}`); setNotice('Link monouso creato. Scade tra 7 giorni.') }
    catch (reason) { setError(errorMessage(reason)) } finally { setBusy(false) }
  }
  const revokeLink = async (person: OrganizationStaffPerson) => {
    if (!window.confirm(`Revocare il collegamento account di ${person.firstName} ${person.lastName} e i soli accessi gestiti da questo flusso?`)) return
    setBusy(true); setError(''); setNotice(''); setInviteUrl('')
    try { await revokeStaffAccountLink(organizationId, person.id); setNotice('Collegamento e accessi gestiti revocati.'); await load() }
    catch (reason) { setError(errorMessage(reason)) } finally { setBusy(false) }
  }

  return <section className="mt-8" aria-labelledby="organization-staff-title">
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">Anagrafica organizzativa</p><h2 id="organization-staff-title" className="mt-1 text-2xl font-bold">Staff</h2><p className="mt-1 text-sm text-app-muted">Persone e assegnazioni previste in {organizationName}. Non concedono accessi o permessi.</p></div><Button variant="primary" onClick={() => { setEditor(true); setError(''); setNotice('') }}><Plus size={17} />Aggiungi persona</Button></div>
    {notice && <p role="status" className="mb-3 rounded-xl border border-app-success/40 bg-app-success/10 p-3 text-sm">{notice}</p>}{inviteUrl && <Card className="mb-3 grid gap-2" padding="sm"><strong>Link di collegamento account</strong><code className="break-all text-xs">{inviteUrl}</code><Button size="sm" onClick={() => void navigator.clipboard.writeText(inviteUrl)}>Copia link</Button></Card>}{error && !editor && !assignmentEditor && <ErrorState message={error} action={<Button onClick={() => void load()}>Riprova</Button>} />}
    {loading ? <LoadingState label="Caricamento staff…" /> : people.length === 0 ? <EmptyState icon={UserRound} title="Nessuna persona registrata" description="Aggiungi un’anagrafica senza creare account, email o accessi operativi." action={<Button variant="primary" onClick={() => setEditor(true)}>Aggiungi la prima persona</Button>} /> : <div className="grid gap-3 lg:grid-cols-2">{people.map(person => <PersonCard key={person.id} person={person} assignments={assignments.filter(item => item.staffPersonId === person.id)} groups={groups} busy={busy} onEdit={() => { setEditor(person); setError(''); setNotice('') }} onAssign={assignment => { setAssignmentEditor({ person, assignment }); setError(''); setNotice('') }} onRemove={assignment => void removeAssignment(person, assignment)} onCreateLink={() => void createLink(person)} onRevokeLink={() => void revokeLink(person)} />)}</div>}
    {editor && <PersonEditor editor={editor} organizationName={organizationName} busy={busy} error={error} onClose={() => setEditor(undefined)} onSubmit={savePerson} />}
    {assignmentEditor && <AssignmentEditorSheet editor={assignmentEditor} groups={groups} busy={busy} error={error} onClose={() => setAssignmentEditor(undefined)} onSubmit={saveAssignment} />}
  </section>
}

function PersonCard({ person, assignments, groups, busy, onEdit, onAssign, onRemove, onCreateLink, onRevokeLink }: { person: OrganizationStaffPerson; assignments: OrganizationStaffGroupAssignment[]; groups: Group[]; busy: boolean; onEdit: () => void; onAssign: (assignment?: OrganizationStaffGroupAssignment) => void; onRemove: (assignment: OrganizationStaffGroupAssignment) => void; onCreateLink: () => void; onRevokeLink: () => void }) {
  return <Card className="grid gap-3" padding="sm"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><strong className="block text-lg">{person.firstName} {person.lastName}</strong><p className="mt-1 text-sm text-app-muted">Ruolo previsto generale: {person.intendedRole === 'coach' ? 'Allenatore' : 'Collaboratore'}</p><Badge variant={person.linkedUserId ? 'success' : 'neutral'}>{person.linkedUserId ? 'Account collegato' : 'Non collegato'}</Badge></div><Button size="icon" variant="ghost" aria-label={`Modifica ${person.firstName} ${person.lastName}`} onClick={onEdit}><Pencil size={16} /></Button></div><div className="flex flex-wrap gap-2">{person.linkedUserId ? <Button size="sm" variant="danger" disabled={busy} onClick={onRevokeLink}><Unlink size={15} />Revoca collegamento</Button> : <Button size="sm" disabled={busy} onClick={onCreateLink}><Link2 size={15} />Crea link account</Button>}</div><div className="grid gap-2"><div className="flex items-center justify-between gap-2"><h3 className="font-semibold">WorkGroup assegnati</h3><Button size="sm" disabled={groups.length === 0 || busy} onClick={() => onAssign()}><Plus size={15} />Assegna</Button></div>{assignments.length === 0 ? <p className="rounded-lg border border-dashed border-app-border p-3 text-sm text-app-muted">Nessuna assegnazione prevista.</p> : assignments.map(assignment => { const group = groups.find(item => item.id === assignment.groupId); return <div key={assignment.id} className="rounded-xl border border-app-border bg-app-elevated p-3"><div className="flex items-start justify-between gap-2"><div><strong>{group?.name ?? 'WorkGroup non disponibile'}</strong><p className="text-sm text-app-muted">{assignment.intendedRole === 'coach' ? 'Allenatore' : 'Collaboratore'}</p></div><div className="flex gap-1"><Button size="icon" variant="ghost" aria-label={`Modifica assegnazione ${group?.name ?? ''}`} disabled={busy} onClick={() => onAssign(assignment)}><Pencil size={15} /></Button><Button size="icon" variant="ghost" aria-label={`Rimuovi assegnazione ${group?.name ?? ''}`} disabled={busy} onClick={() => onRemove(assignment)}><Trash2 size={15} /></Button></div></div><p className="mt-2 text-xs font-semibold text-app-warning">{person.linkedUserId ? 'Accesso gestito sincronizzato con il ruolo previsto' : 'Assegnazione prevista — account non collegato'}</p></div> })}</div></Card>
}

function PersonEditor({ editor, organizationName, busy, error, onClose, onSubmit }: { editor: OrganizationStaffPerson | true; organizationName: string; busy: boolean; error: string; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <div className="sheet-backdrop" role="presentation"><section className="add-player-sheet" role="dialog" aria-modal="true" aria-labelledby="staff-person-title"><div className="sheet-handle" /><header className="exercise-sheet-header"><div><span className="eyebrow">Staff · {organizationName}</span><h1 id="staff-person-title">{editor === true ? 'Registra persona' : 'Modifica anagrafica'}</h1><p className="mt-2 text-sm text-app-muted">Nessun account o accesso verrà creato.</p></div><Button size="icon" variant="ghost" aria-label="Chiudi" disabled={busy} onClick={onClose}><X size={18} /></Button></header><form className="add-player-scroll" onSubmit={onSubmit}><Field label="Nome"><Input name="firstName" required autoFocus maxLength={120} disabled={busy} defaultValue={editor === true ? '' : editor.firstName} /></Field><Field label="Cognome"><Input name="lastName" required maxLength={120} disabled={busy} defaultValue={editor === true ? '' : editor.lastName} /></Field><Field label="Ruolo previsto" hint="È solo un metadato: non concede permessi."><Select name="intendedRole" defaultValue={editor === true ? 'collaborator' : editor.intendedRole} disabled={busy}><option value="coach">Allenatore</option><option value="collaborator">Collaboratore</option></Select></Field>{editor !== true && <p className="rounded-xl border border-app-border bg-app-elevated p-3 text-sm">Stato account: <strong>{editor.linkedUserId ? 'Collegato' : 'Non collegato'}</strong></p>}{error && <ErrorState message={error} />}<div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="ghost" disabled={busy} onClick={onClose}>Annulla</Button><Button variant="primary" loading={busy}>Conferma e salva</Button></div></form></section></div>
}

function AssignmentEditorSheet({ editor, groups, busy, error, onClose, onSubmit }: { editor: AssignmentEditor; groups: Group[]; busy: boolean; error: string; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <div className="sheet-backdrop" role="presentation"><section className="add-player-sheet" role="dialog" aria-modal="true" aria-labelledby="staff-assignment-title"><div className="sheet-handle" /><header className="exercise-sheet-header"><div><span className="eyebrow">Assegnazione amministrativa</span><h1 id="staff-assignment-title">{editor.assignment ? 'Modifica assegnazione' : 'Assegna ai WorkGroup'}</h1><p className="mt-2 text-sm text-app-muted">{editor.person.firstName} {editor.person.lastName} · nessun permesso operativo verrà attivato.</p></div><Button size="icon" variant="ghost" aria-label="Chiudi" disabled={busy} onClick={onClose}><X size={18} /></Button></header><form className="add-player-scroll" onSubmit={onSubmit}><Field label="WorkGroup"><Select name="groupId" required autoFocus disabled={busy} defaultValue={editor.assignment?.groupId ?? ''}><option value="">Seleziona gruppo</option>{groups.map(group => <option key={group.id} value={group.id}>{group.name}{group.season ? ` · ${group.season}` : ''}</option>)}</Select></Field><Field label="Ruolo nel gruppo" hint="Ruolo previsto, non una membership operativa."><Select name="intendedRole" defaultValue={editor.assignment?.intendedRole ?? editor.person.intendedRole} disabled={busy}><option value="coach">Allenatore</option><option value="collaborator">Collaboratore</option></Select></Field><p className="rounded-xl border border-app-warning/40 bg-app-warning/10 p-3 text-sm">{editor.person.linkedUserId ? 'Account collegato: la membership non verrà sincronizzata automaticamente.' : 'Assegnazione prevista — account non collegato'}</p>{error && <ErrorState message={error} />}<div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="ghost" disabled={busy} onClick={onClose}>Annulla</Button><Button variant="primary" loading={busy}>Conferma assegnazione</Button></div></form></section></div>
}

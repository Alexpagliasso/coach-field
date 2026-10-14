import { useRef, useState, type FormEvent } from 'react'
import { Archive, MoreVertical, Trash2, UserMinus, Users } from 'lucide-react'
import {
  archiveOrganizationPlayer,
  deleteOrganizationPlayer,
  removeTeamRosterPlayer,
  type GroupPlayerAssignment,
  type TeamRosterEntry,
} from '../cloud/playerCloudRepository'
import {
  availablePlayerLifecycleActions,
  playerLifecycleErrorMessage,
  rosterLifecycleState,
  type PlayerLifecycleAction,
  type RosterLifecycleFilter,
} from '../cloud/playerLifecycle'
import type { Group } from '../types/staff'
import { Badge, Button, Card, EmptyState, ErrorState, Input } from './ui'
import { DialogSheet } from './DialogSheet'

const filterLabels: Record<RosterLifecycleFilter, string> = { active: 'Attivi', left: 'Usciti dalla categoria', archived: 'Archiviati' }
const statusLabels: Record<RosterLifecycleFilter, string> = { active: 'Attivo', left: 'Uscito', archived: 'Archiviato' }

type Props = {
  roster: TeamRosterEntry[]
  assignments: GroupPlayerAssignment[]
  groups: Group[]
  teamName: string
  organizationId: string
  admin: boolean
  archiveEligiblePlayerIds: Set<string>
  onAssign: (entry: TeamRosterEntry) => void
  onRemoveFromGroup: (entry: TeamRosterEntry) => void
  onRefresh: () => Promise<void>
}

export function CategoryRoster({ roster, assignments, groups, teamName, organizationId, admin, archiveEligiblePlayerIds, onAssign, onRemoveFromGroup, onRefresh }: Props) {
  const [filter, setFilter] = useState<RosterLifecycleFilter>('active')
  const [dialog, setDialog] = useState<{ entry: TeamRosterEntry; action: PlayerLifecycleAction }>()
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const lock = useRef(false)
  const filteredRoster = roster.filter(entry => rosterLifecycleState(entry) === filter)

  const openDialog = (entry: TeamRosterEntry, action: PlayerLifecycleAction) => {
    setDialog({ entry, action }); setConfirmation(''); setError(''); setNotice('')
  }
  const closeDialog = () => {
    if (busy) return
    setDialog(undefined); setConfirmation(''); setError('')
  }
  const submitLifecycle = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!dialog || lock.current) return
    const { entry, action } = dialog
    const fullName = `${entry.player.firstName} ${entry.player.lastName}`
    if (action === 'delete' && confirmation !== fullName) return
    lock.current = true; setBusy(true); setError('')
    try {
      if (action === 'remove') await removeTeamRosterPlayer(entry.membership.id)
      if (action === 'archive') await archiveOrganizationPlayer(entry.player.id, organizationId)
      if (action === 'delete') await deleteOrganizationPlayer(entry.player.id, organizationId)
      await onRefresh()
      setDialog(undefined); setConfirmation('')
      setNotice(action === 'remove' ? `${fullName} è stato rimosso dalla categoria.` : action === 'archive' ? `${fullName} è stato archiviato.` : `${fullName} è stato eliminato definitivamente.`)
    } catch (reason) { setError(playerLifecycleErrorMessage(reason)) }
    finally { lock.current = false; setBusy(false) }
  }

  return <>
    <div className="mb-4 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filtra la rosa per stato">
      {(Object.keys(filterLabels) as RosterLifecycleFilter[]).map(value => <Button key={value} size="sm" variant={filter === value ? 'primary' : 'secondary'} aria-pressed={filter === value} onClick={() => { setFilter(value); setNotice('') }}>{filterLabels[value]} <span aria-hidden="true">({roster.filter(entry => rosterLifecycleState(entry) === value).length})</span></Button>)}
    </div>
    {notice && <div role="status" className="mb-4 rounded-xl border border-app-success/50 bg-app-success/10 p-3 text-sm font-semibold text-app-text">{notice}</div>}
    {filteredRoster.length === 0 ? <EmptyState icon={Users} title={`Nessun giocatore: ${filterLabels[filter].toLowerCase()}`} description={filter === 'active' ? 'Aggiungi un giocatore o consulta gli altri stati della rosa.' : 'I giocatori con questo stato resteranno consultabili qui.'} /> : <div className="grid gap-3">{filteredRoster.map(entry => {
      const { membership, player } = entry
      const state = rosterLifecycleState(entry)
      const assignment = assignments.find(item => item.teamPlayerMembershipId === membership.id)
      const group = groups.find(item => item.id === assignment?.groupId)
      const actions = availablePlayerLifecycleActions(entry).filter(action => action !== 'archive' || archiveEligiblePlayerIds.has(player.id))
      return <Card key={membership.id} className="grid gap-3 md:grid-cols-[minmax(0,2fr)_1fr_1fr_1.2fr_auto] md:items-center">
        <div><h3 className="font-bold text-app-text">{player.firstName} {player.lastName}</h3><p className="text-sm text-app-muted">{player.birthYear ? `Anno ${player.birthYear}` : 'Anno di nascita non indicato'}</p></div>
        <div><span className="text-xs font-bold uppercase tracking-wide text-app-muted">Stato</span><p className="mt-1"><Badge variant={state === 'active' ? 'success' : state === 'archived' ? 'warning' : 'neutral'}>{statusLabels[state]}</Badge></p></div>
        <div><span className="text-xs font-bold uppercase tracking-wide text-app-muted">Categoria</span><p className="mt-1 font-semibold">{teamName}</p></div>
        <div><span className="text-xs font-bold uppercase tracking-wide text-app-muted">WorkGroup attuale</span><p className="mt-1 font-semibold">{state === 'active' ? group?.name ?? 'Non assegnato' : '—'}</p></div>
        {admin && <div className="flex items-center justify-end gap-2">
          {state === 'active' && <Button size="sm" onClick={() => onAssign(entry)}>{assignment ? 'Cambia gruppo' : 'Assegna a gruppo'}</Button>}
          {state === 'active' && assignment && <Button size="sm" variant="danger" onClick={() => onRemoveFromGroup(entry)}>Rimuovi dal gruppo</Button>}
          <details className="relative">
            <summary className="flex size-11 cursor-pointer list-none items-center justify-center rounded-xl border border-app-border bg-app-elevated text-app-text" aria-label={`Azioni per ${player.firstName} ${player.lastName}`}><MoreVertical size={20} /></summary>
            <div className="absolute right-0 z-20 mt-2 grid min-w-60 gap-1 rounded-xl border border-app-border bg-app-surface p-2 shadow-xl">
              {actions.includes('remove') && <button type="button" className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-left text-sm font-semibold hover:bg-app-elevated" onClick={() => openDialog(entry, 'remove')}><UserMinus size={18} />Rimuovi dalla categoria</button>}
              {actions.includes('archive') && <button type="button" className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-left text-sm font-semibold hover:bg-app-elevated" onClick={() => openDialog(entry, 'archive')}><Archive size={18} />Archivia giocatore</button>}
              {actions.includes('delete') && <button type="button" className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-left text-sm font-semibold text-app-danger hover:bg-app-danger/10" onClick={() => openDialog(entry, 'delete')}><Trash2 size={18} />Elimina definitivamente</button>}
              {actions.length === 0 && <span className="px-3 py-2 text-sm text-app-muted">Archiviazione non disponibile: esistono membership attive.</span>}
            </div>
          </details>
        </div>}
      </Card>
    })}</div>}

    {dialog && <DialogSheet onClose={closeDialog} busy={busy} labelledBy="player-lifecycle-title"><div className="sheet-handle" /><header className="exercise-sheet-header"><div><span className="eyebrow">Rosa · {teamName}</span><h1 id="player-lifecycle-title">{dialog.action === 'remove' ? 'Rimuovi dalla categoria' : dialog.action === 'archive' ? 'Archivia giocatore' : 'Elimina definitivamente'}</h1><p className="mt-2 text-sm text-app-muted">{dialog.entry.player.firstName} {dialog.entry.player.lastName}</p></div></header><form className="add-player-scroll" onSubmit={submitLifecycle}>
      {dialog.action === 'remove' && <p>Il giocatore verrà rimosso dalla rosa attiva e da eventuali WorkGroup della categoria, conservando lo storico.</p>}
      {dialog.action === 'archive' && <><p>Il giocatore verrà archiviato nell’organizzazione senza perdere lo storico.</p><p className="text-sm text-app-muted">L’operazione è consentita solo se non esistono membership attive, incluse quelle legacy. Il cloud verificherà la condizione prima di procedere.</p></>}
      {dialog.action === 'delete' && <><div className="rounded-xl border border-app-danger/50 bg-app-danger/10 p-3"><strong>Operazione irreversibile.</strong><p className="mt-1 text-sm">Saranno eliminati il profilo e le membership e assegnazioni cloud consentite. Collegamenti legacy o altri dati protetti bloccheranno l’operazione.</p><p className="mt-1 text-sm">Questa verifica riguarda il cloud e non garantisce l’assenza di riferimenti in IndexedDB.</p></div><label className="grid gap-2 text-sm font-semibold"><span>Digita esattamente “{dialog.entry.player.firstName} {dialog.entry.player.lastName}”</span><Input value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="off" autoFocus disabled={busy} /></label></>}
      {error && <ErrorState message={error} />}
      <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="ghost" onClick={closeDialog} disabled={busy}>Annulla</Button><Button type="submit" variant="danger" loading={busy} disabled={dialog.action === 'delete' && confirmation !== `${dialog.entry.player.firstName} ${dialog.entry.player.lastName}`}>{dialog.action === 'remove' ? 'Conferma rimozione' : dialog.action === 'archive' ? 'Conferma archiviazione' : 'Elimina definitivamente'}</Button></div>
    </form></DialogSheet>}
  </>
}

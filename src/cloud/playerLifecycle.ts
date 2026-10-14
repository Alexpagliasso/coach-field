import type { TeamRosterEntry } from './playerCloudRepository'

export type RosterLifecycleFilter = 'active' | 'left' | 'archived'
export type PlayerLifecycleAction = 'remove' | 'archive' | 'delete'

export function rosterLifecycleState(entry: TeamRosterEntry): RosterLifecycleFilter {
  if (entry.player.archivedAt) return 'archived'
  return entry.membership.status === 'active' ? 'active' : 'left'
}

export function availablePlayerLifecycleActions(entry: TeamRosterEntry): PlayerLifecycleAction[] {
  const state = rosterLifecycleState(entry)
  if (state === 'active') return ['remove']
  if (state === 'archived') return ['delete']
  return ['archive']
}

export function playerLifecycleErrorMessage(error: unknown) {
  const record = typeof error === 'object' && error ? error as Record<string, unknown> : undefined
  const code = String(record?.code ?? '')
  const message = String(record?.message ?? (error instanceof Error ? error.message : ''))
  const normalized = message.toLowerCase()

  if (code === 'PGRST202' || code === '42883' || (normalized.includes('function') && (normalized.includes('schema cache') || normalized.includes('does not exist')))) {
    return 'Funzione cloud non disponibile. Applica prima la migration player lifecycle al database Supabase e ricarica lo schema.'
  }
  if (code === '42501' || normalized.includes('permission denied')) return 'Non hai i permessi amministrativi necessari per questa operazione.'
  if (normalized.includes('active team roster')) return 'Il giocatore appartiene ancora a una rosa di categoria attiva. Rimuovilo prima da tutte le rose attive.'
  if (normalized.includes('active legacy group membership')) return 'Il giocatore ha ancora una membership legacy attiva e non può essere archiviato.'
  if (normalized.includes('legacy group history')) return 'Eliminazione bloccata: esistono collegamenti legacy da preservare.'
  if (normalized.includes('must be archived')) return 'Il giocatore deve essere archiviato prima dell’eliminazione definitiva.'
  if (normalized.includes('not found')) return 'Il giocatore o la membership non è più disponibile. Aggiorna la rosa e riprova.'
  return message || 'Operazione non riuscita. Verifica la connessione e riprova.'
}

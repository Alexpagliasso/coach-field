import { ChevronLeft, ChevronRight, Users } from 'lucide-react'
import { useRef, useState } from 'react'
import type { WorkGroupRosterEntry } from '../cloud/playerCloudRepository'
import { useGroup } from '../groups/groupContext'
import { PlayerProfileModal } from './PlayerProfileModal'
import { Button, EmptyState } from './ui'

type Props = { roster: WorkGroupRosterEntry[]; groupId?: string }

function initials(firstName: string, lastName: string) { return (firstName.slice(0, 1) + lastName.slice(0, 1)).toUpperCase() }

export function WorkGroupRosterPreview({ roster, groupId }: Props) {
  const { activeGroup } = useGroup()
  const strip = useRef<HTMLDivElement>(null)
  const [playerId, setPlayerId] = useState<string>()
  const resolvedGroupId = groupId ?? activeGroup?.id
  const scroll = (direction: number) => strip.current?.scrollBy({ left: direction * Math.max(180, strip.current.clientWidth * 0.8), behavior: 'smooth' })
  if (roster.length === 0) return <EmptyState icon={Users} title="Rosa WorkGroup vuota" description="Non ci sono giocatori assegnati stabilmente a questo WorkGroup." />
  return <><div className="grid gap-3">
    <div className="flex items-center justify-between gap-2"><p className="text-sm text-app-muted">{roster.length} giocatori assegnati stabilmente</p><div className="hidden gap-1 sm:flex"><Button size="icon" variant="ghost" aria-label="Giocatori precedenti" onClick={() => scroll(-1)}><ChevronLeft size={17} /></Button><Button size="icon" variant="ghost" aria-label="Giocatori successivi" onClick={() => scroll(1)}><ChevronRight size={17} /></Button></div></div>
    <div ref={strip} className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]" aria-label="Anteprima rosa WorkGroup">{roster.map(({ assignment, player }) => <button type="button" key={assignment.id} onClick={() => setPlayerId(player.id)} className="player-profile-trigger min-w-24 snap-start rounded-xl border border-app-border bg-app-elevated p-3 text-left sm:min-w-20" aria-label={`Apri profilo di ${player.firstName} ${player.lastName}`}>{player.avatarUrl ? <img src={player.avatarUrl} alt="" className="mb-2 size-10 rounded-full object-cover" /> : <span className="mb-2 flex size-10 items-center justify-center rounded-full bg-app-primary/15 text-sm font-black text-app-primary" aria-hidden="true">{initials(player.firstName, player.lastName)}</span>}<strong className="block truncate text-sm text-app-text">{player.firstName}</strong><small className="block truncate text-app-muted">{player.lastName || '-'}</small></button>)}</div>
  </div><PlayerProfileModal open={Boolean(playerId)} playerId={playerId} groupId={resolvedGroupId} onClose={() => setPlayerId(undefined)} /></>
}

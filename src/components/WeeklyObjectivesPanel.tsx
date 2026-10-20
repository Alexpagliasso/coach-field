import { useEffect, useState } from 'react'
import { CalendarDays, Check, Copy, Target } from 'lucide-react'
import { getOrganizationFamilyPublications, type FamilyPublication } from '../cloud/familyPublicationsRepository'
import { weekStart } from '../utils/familyDiaryWeeks'
import { FamilyPublicationSheet, type FamilyPublicationDraft } from './FamilyPublicationSheet'
import { Badge, Button, LoadingState } from './ui'

/** Weekly objectives are scoped to the active WorkGroup, never the whole organization. */
export function WeeklyObjectivesPanel({ organizationId, groupId, editable }: { organizationId: string; groupId: string; editable: boolean }) {
  const [referenceDate, setReferenceDate] = useState(() => weekStart(new Date()))
  const [items, setItems] = useState<FamilyPublication[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [copyState, setCopyState] = useState<'idle' | 'success' | 'error'>('idle')
  const load = async () => {
    setLoading(true)
    try {
      const all = await getOrganizationFamilyPublications(organizationId)
      setItems(all.filter(item => item.contentType === 'objective' && item.groupId === groupId && weekStart(item.referenceDate) === referenceDate))
    } finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [organizationId, groupId, referenceDate])
  const publication = items[0]
  const draft: FamilyPublicationDraft = { contentType: 'objective', groupId, referenceDate, title: 'Obiettivi della settimana', publicContent: '', label: 'Obiettivi settimanali per le famiglie' }
  const copyFamilyLink = async () => {
    const url = new URL(`/famiglie/${groupId}`, window.location.origin).toString()
    try {
      if (navigator.clipboard?.writeText && window.isSecureContext) await navigator.clipboard.writeText(url)
      else {
        const input = document.createElement('textarea'); input.value = url; input.style.position = 'fixed'; input.style.opacity = '0'; document.body.append(input); input.select()
        try { if (!document.execCommand('copy')) throw new Error('copy failed') } finally { input.remove() }
      }
      setCopyState('success')
    } catch { setCopyState('error') }
  }
  return <section className="weekly-objectives-panel" aria-labelledby="weekly-objectives-panel-title">
    <div className="weekly-objectives-panel-head"><div><p className="eyebrow">Area famiglie</p><h2 id="weekly-objectives-panel-title"><Target size={18} />Obiettivi settimanali</h2><p>Collegati al WorkGroup attivo e visibili solo nel relativo diario pubblico.</p></div>{editable && <div className="flex flex-wrap gap-2"><Button size="sm" variant="secondary" onClick={() => void copyFamilyLink()}>{copyState === 'success' ? <Check size={16} /> : <Copy size={16} />}{copyState === 'success' ? 'Link copiato' : 'Copia link famiglie'}</Button><Button size="sm" variant="secondary" onClick={() => setOpen(true)}>{publication ? 'Modifica obiettivi' : 'Crea obiettivi'}</Button></div>}</div>
    {copyState === 'error' && <p className="weekly-objectives-panel-warning">Non siamo riusciti a copiare il link. Copialo dalla barra del browser.</p>}
    <div className="weekly-objectives-panel-date"><CalendarDays size={16} /><label>Settimana di riferimento<input type="date" value={referenceDate} onChange={event => event.target.value && setReferenceDate(weekStart(event.target.value))} /></label></div>
    {loading ? <LoadingState label="Caricamento obiettivi…" /> : items.length > 1 ? <p className="weekly-objectives-panel-warning">Sono presenti più obiettivi per questa settimana. Apri la modifica per risolvere il conflitto.</p> : publication ? <article><div><Badge variant={publication.status === 'published' ? 'success' : 'neutral'}>{publication.status === 'published' ? 'Pubblicato' : 'Bozza'}</Badge><h3>{publication.title}</h3></div><p>{publication.publicContent}</p></article> : <p className="weekly-objectives-panel-empty">Nessun obiettivo creato per questa settimana.</p>}
    {open && <FamilyPublicationSheet organizationId={organizationId} draft={draft} onChanged={() => void load()} onClose={() => { setOpen(false); void load() }} />}
  </section>
}

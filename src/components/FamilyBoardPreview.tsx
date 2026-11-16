import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowRight, FileText } from 'lucide-react'
import { getFamilyPublicRoute, getLatestPublishedFamilyPublications, type FamilyPublicationType, type PublishedFamilyPublication } from '../cloud/familyPublicationsRepository'
import { DashboardPanel, DashboardSectionHeading } from './DashboardPrimitives'
import { Badge, Button, ErrorState, LoadingState } from './ui'

const labels: Record<FamilyPublicationType, string> = { training: 'Allenamento', objective: 'Obiettivo', match_reflection: 'Partita' }
const publicationDate = (item: PublishedFamilyPublication) => new Date(item.publishedAt ?? `${item.referenceDate}T12:00:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })
const preview = (value: string) => value.replace(/\s+/g, ' ').trim().slice(0, 120)

export function FamilyBoardPreview({ groupId }: { groupId: string }) {
  const [items, setItems] = useState<PublishedFamilyPublication[]>([]), [publicPath, setPublicPath] = useState('')
  const [loading, setLoading] = useState(true), [error, setError] = useState('')
  const request = useRef(0)
  const load = useCallback(async () => {
    const current = ++request.current
    setLoading(true); setError(''); setItems([]); setPublicPath('')
    try {
      const [publications, path] = await Promise.all([getLatestPublishedFamilyPublications(groupId, 2), getFamilyPublicRoute(groupId)])
      if (current !== request.current) return
      setItems(publications); setPublicPath(path ?? '')
    } catch (cause) {
      if (current === request.current) setError(cause instanceof Error ? cause.message : 'Bacheca Famiglie non disponibile.')
    } finally { if (current === request.current) setLoading(false) }
  }, [groupId])
  useEffect(() => { void load() }, [load])

  const action = publicPath ? <a href={publicPath} className="dashboard-text-link">Vai alla pagina Famiglie <ArrowRight size={15} /></a> : undefined
  return <DashboardPanel className="dashboard-v7-family-board" tone="quiet">
    <DashboardSectionHeading eyebrow="Comunicazione" title="Bacheca Famiglie" action={action} />
    {loading ? <LoadingState label="Caricamento bacheca famiglie..." /> : error ? <ErrorState message={error} action={<Button size="sm" onClick={() => void load()}>Riprova</Button>} /> : items.length ? <div className="grid gap-2">{items.map((item, index) => <details key={`${item.publishedAt ?? item.referenceDate}-${item.contentType}-${index}`} className="group rounded-xl border border-app-border bg-app-elevated p-3"><summary className="cursor-pointer list-none"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="mb-1 flex flex-wrap items-center gap-2"><Badge variant="neutral">{labels[item.contentType]}</Badge><time className="text-xs text-app-muted">{publicationDate(item)}</time></div><h3 className="truncate font-bold">{item.title}</h3><p className="mt-1 line-clamp-2 text-sm text-app-muted">{preview(item.publicContent)}{item.publicContent.trim().length > 120 ? '…' : ''}</p></div><ArrowRight className="mt-1 shrink-0 transition-transform group-open:rotate-90" size={17} /></div></summary><p className="mt-3 whitespace-pre-wrap border-t border-app-border pt-3 text-sm leading-relaxed">{item.publicContent}</p></details>)}</div> : <div className="dashboard-v7-empty"><FileText size={20} /><p>Nessuna pubblicazione per questo WorkGroup.</p></div>}
    {!loading && !error && !publicPath && <p className="mt-2 text-xs text-app-muted">Il link pubblico del WorkGroup non è ancora disponibile.</p>}
  </DashboardPanel>
}

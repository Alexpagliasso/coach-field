import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, FileText } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { getPublishedFamilyPublicationPage, type PublishedFamilyPublication } from '../cloud/familyPublicationsRepository'
import { addWeeks, nextWeek, weekStart } from '../utils/familyDiaryWeeks'
import { APP_NAME } from '../brand'
import { Button, LoadingState } from '../components/ui'

type Tab = 'training' | 'match_reflection'
const archivePageSize = 5
const weeklyContentPageSize = 100
const labels: Record<Tab, string> = { training: 'Allenamenti', match_reflection: 'Partite' }
const formatDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
const formatWeek = (monday: string) => `${formatDate(monday)} – ${formatDate(addWeeks(monday, 1))}`

export function FamiliesPage() {
  const { groupId: publicGroupId } = useParams()
  const currentMonday = useMemo(() => weekStart(new Date()), [])
  const [tab, setTab] = useState<Tab>('training')
  const [weekOffset, setWeekOffset] = useState(0)
  const [groupScope, setGroupScope] = useState<string | null | undefined>(undefined)
  const [objectives, setObjectives] = useState<PublishedFamilyPublication[]>([])
  const [items, setItems] = useState<PublishedFamilyPublication[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [archiveMonth, setArchiveMonth] = useState(currentMonday.slice(0, 7))
  const [archiveItems, setArchiveItems] = useState<PublishedFamilyPublication[]>([])
  const [archivePage, setArchivePage] = useState(0)
  const [archiveHasMore, setArchiveHasMore] = useState(false)
  const [archiveLoading, setArchiveLoading] = useState(false)
  const [archiveError, setArchiveError] = useState(false)
  const touchStart = useRef<number | null>(null)
  const selectedWeek = addWeeks(currentMonday, -weekOffset)
  const scoped = (filters: Parameters<typeof getPublishedFamilyPublicationPage>[0]) => ({ ...filters, ...(publicGroupId ? { publicGroupId } : groupScope === undefined ? {} : { groupId: groupScope }) })

  useEffect(() => {
    let active = true
    setLoading(true); setError(false); setExpanded(new Set())
    void Promise.all([
      getPublishedFamilyPublicationPage(scoped({ contentTypes: ['objective'], from: currentMonday, to: nextWeek(currentMonday) }), 0, 12),
      getPublishedFamilyPublicationPage(scoped({ contentTypes: [tab], from: selectedWeek, to: nextWeek(selectedWeek) }), 0, weeklyContentPageSize),
    ]).then(([weeklyObjectives, weeklyItems]) => {
      if (active) { setObjectives(weeklyObjectives.items); setItems(weeklyItems.items) }
    }).catch(() => active && setError(true)).finally(() => active && setLoading(false))
    return () => { active = false }
  }, [currentMonday, groupScope, publicGroupId, selectedWeek, tab])

  const loadArchive = async (requestedPage: number) => {
    setArchiveLoading(true); setArchiveError(false)
    try {
      const result = await getPublishedFamilyPublicationPage(scoped({ contentTypes: [tab], month: archiveMonth }), requestedPage, archivePageSize)
      setArchiveItems(result.items)
      setArchivePage(requestedPage); setArchiveHasMore(result.hasMore)
    } catch { setArchiveError(true) } finally { setArchiveLoading(false) }
  }
  useEffect(() => { if (archiveOpen) void loadArchive(0) }, [archiveOpen, archiveMonth, tab, groupScope, publicGroupId])

  const changeTab = (next: Tab) => { setTab(next); setWeekOffset(0); setArchiveItems([]); setExpanded(new Set()) }
  const changeWeek = (delta: number) => { setWeekOffset(current => Math.max(0, Math.min(2, current + delta))) }
  const changeScope = (next: string | null | undefined) => { setGroupScope(next); setArchiveItems([]); setExpanded(new Set()) }
  const toggle = (prefix: string, item: PublishedFamilyPublication, index: number) => {
    const key = `${prefix}-${item.referenceDate}-${item.title}-${index}`
    setExpanded(current => { const next = new Set(current); next.has(key) ? next.delete(key) : next.add(key); return next })
  }
  const swipe = (endX: number) => {
    if (touchStart.current === null) return
    const distance = endX - touchStart.current; touchStart.current = null
    if (Math.abs(distance) < 42) return
    changeWeek(distance < 0 ? 1 : -1)
  }
  const publishedGroupScopes = [...new Set([...objectives, ...items, ...archiveItems].map(item => item.groupId).filter((id): id is string => Boolean(id)))].sort()

  return <div className="families-compact families-page-light">
    <a className="public-skip" href="#famiglie-contenuto">Vai al contenuto</a>
    <header className="families-compact-header"><div className="families-compact-shell"><h1>Diario dal campo</h1><Link to="/" className="families-compact-brand" aria-label="GrowPitch, torna alla pagina iniziale">GP <span>{APP_NAME}</span></Link></div></header>
    <main id="famiglie-contenuto" className="families-compact-shell families-compact-main">
      <section className="families-week-panel" aria-labelledby="weekly-content-title" onTouchStart={event => { touchStart.current = event.touches[0]?.clientX ?? null }} onTouchEnd={event => swipe(event.changedTouches[0]?.clientX ?? 0)}>
        <div className="families-week-nav"><Button size="icon" variant="ghost" disabled={weekOffset === 0} aria-disabled={weekOffset === 0} aria-label="Settimana successiva" onClick={() => changeWeek(-1)}><ChevronLeft size={20} /></Button><div><p id="weekly-content-title">Settimana selezionata</p><strong>{weekOffset === 0 ? 'Questa settimana' : `${weekOffset} settimana${weekOffset > 1 ? 'e' : ''} fa`}</strong><small>{formatWeek(selectedWeek)}</small></div><Button size="icon" variant="ghost" disabled={weekOffset === 2} aria-disabled={weekOffset === 2} aria-label="Settimana precedente" onClick={() => changeWeek(1)}><ChevronRight size={20} /></Button></div>
      </section>
      <section className="families-weekly-objectives" aria-labelledby="weekly-objectives-title"><div><p>Obiettivi settimanali</p><h2 id="weekly-objectives-title">Obiettivi della settimana</h2></div>{loading ? <LoadingState label="Caricamento obiettivi…" /> : error ? <Empty message="Obiettivi non disponibili. Riprova tra poco." /> : objectives.length ? <div className="families-objective-list">{objectives.map((item, index) => <PublicObjective key={`objective-${item.referenceDate}-${item.title}-${index}`} item={item} />)}</div> : <p className="families-weekly-empty">Non ci sono obiettivi pubblicati per questa settimana.</p>}</section>
      {!publicGroupId && publishedGroupScopes.length > 0 && <nav className="families-compact-tabs families-scope-tabs" aria-label="Percorso pubblicato"><button type="button" className={groupScope === undefined ? 'active' : ''} onClick={() => changeScope(undefined)}>Tutti</button><button type="button" className={groupScope === null ? 'active' : ''} onClick={() => changeScope(null)}>Generali</button>{publishedGroupScopes.map((scope, index) => <button key={scope} type="button" className={groupScope === scope ? 'active' : ''} onClick={() => changeScope(scope)}>Percorso {index + 1}</button>)}</nav>}
      <nav className="families-compact-tabs families-content-tabs" aria-label="Contenuti del diario"><button type="button" className={tab === 'training' ? 'active training' : ''} aria-pressed={tab === 'training'} onClick={() => changeTab('training')}>Allenamenti</button><button type="button" className={tab === 'match_reflection' ? 'active match' : ''} aria-pressed={tab === 'match_reflection'} onClick={() => changeTab('match_reflection')}>Partite</button></nav>
      <section className={`families-content-panel families-tab-${tab}`} aria-label={labels[tab]}>{loading ? <LoadingState label="Caricamento pubblicazioni…" /> : error ? <Empty message="Contenuti non disponibili. Riprova tra poco." /> : items.length ? <div className="families-compact-list">{items.map((item, index) => <CompactCard key={`${tab}-${item.referenceDate}-${item.title}-${index}`} item={item} expanded={expanded.has(`${tab}-${item.referenceDate}-${item.title}-${index}`)} onToggle={() => toggle(tab, item, index)} />)}</div> : <Empty message="Nessuna pubblicazione per questa settimana." />}</section>
      <section className="families-archive"><Button variant="ghost" className="w-full" onClick={() => setArchiveOpen(value => !value)} aria-expanded={archiveOpen}>{archiveOpen ? 'Chiudi archivio' : 'Apri archivio'}<ChevronDown className={archiveOpen ? 'rotate-180 transition-transform' : 'transition-transform'} size={17} /></Button>{archiveOpen && <div className="families-archive-panel"><label><CalendarDays size={16} /><span>Mese e anno</span><input type="month" value={archiveMonth} onChange={event => setArchiveMonth(event.target.value)} /></label><p>Archivio {labels[tab].toLowerCase()}</p>{archiveLoading && !archiveItems.length ? <LoadingState label="Caricamento archivio…" /> : archiveError ? <Empty message="Archivio non disponibile. Riprova tra poco." /> : archiveItems.length ? <><div className="families-compact-list">{archiveItems.map((item, index) => <CompactCard key={`archive-${item.referenceDate}-${item.title}-${index}`} item={item} expanded={expanded.has(`archive-${item.referenceDate}-${item.title}-${index}`)} onToggle={() => toggle('archive', item, index)} />)}</div><nav className="families-content-pagination families-archive-pagination" aria-label="Paginazione archivio"><span>Pagina {archivePage + 1}</span><div><Button size="sm" variant="ghost" disabled={archivePage === 0 || archiveLoading} onClick={() => void loadArchive(Math.max(0, archivePage - 1))}>Precedente</Button><Button size="sm" variant="secondary" disabled={!archiveHasMore || archiveLoading} loading={archiveLoading} onClick={() => void loadArchive(archivePage + 1)}>Successiva</Button></div></nav></> : <Empty message="Nessuna pubblicazione per questo mese." />}</div>}</section>
    </main><footer className="families-compact-footer"><div className="families-compact-shell">{APP_NAME}<span>Contenuti informativi pubblicati</span></div></footer>
  </div>
}

function CompactCard({ item, expanded, onToggle }: { item: PublishedFamilyPublication; expanded: boolean; onToggle: () => void }) {
  return <article className="families-compact-card"><button type="button" onClick={onToggle} aria-expanded={expanded}><time dateTime={item.referenceDate}>{formatDate(item.referenceDate)}</time><h3>{item.title}</h3><p>{expanded ? item.publicContent : item.publicContent.replace(/\s+/g, ' ').slice(0, 132)}{!expanded && item.publicContent.length > 132 ? '…' : ''}</p>{expanded ? <ChevronUp size={17} /> : <ChevronDown size={17} />}</button></article>
}
function PublicObjective({ item }: { item: PublishedFamilyPublication }) { return <article className="families-public-objective"><time dateTime={item.referenceDate}>{formatDate(item.referenceDate)}</time><h3>{item.title}</h3><p>{item.publicContent}</p></article> }
function Empty({ message }: { message: string }) { return <div className="families-compact-empty"><FileText size={19} /><p>{message}</p></div> }

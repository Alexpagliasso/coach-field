import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { getCloudMatch, type CloudMatch } from '../cloud/matchCloudRepository'
import { MatchLivePanel } from '../components/MatchLivePanel'
import { Button, EmptyState, ErrorState, LoadingState } from '../components/ui'
import { useGroup, usePermissions } from '../groups/groupContext'

export function MatchLivePage() {
  const { id } = useParams(); const navigate = useNavigate(); const { activeGroup } = useGroup(); const { can } = usePermissions()
  const [match, setMatch] = useState<CloudMatch>(), [loading, setLoading] = useState(true), [error, setError] = useState('')
  const sequence = useRef(0)
  const load = useCallback(async () => {
    if (!id || !activeGroup) return
    const current = ++sequence.current; setLoading(true); setError('')
    try { const next = await getCloudMatch(id, activeGroup.id); if (current === sequence.current) setMatch(next) }
    catch (reason) { if (current === sequence.current) setError(reason instanceof Error ? reason.message : 'Live non disponibile.') }
    finally { if (current === sequence.current) setLoading(false) }
  }, [activeGroup?.id, id])
  useEffect(() => {
    void load()
    const resume = () => void load()
    const visible = () => { if (document.visibilityState === 'visible') void load() }
    window.addEventListener('pageshow', resume); document.addEventListener('visibilitychange', visible)
    return () => { window.removeEventListener('pageshow', resume); document.removeEventListener('visibilitychange', visible) }
  }, [load])
  const leave = () => { if (id) sessionStorage.setItem('growpitch:live-dismissed', id); navigate(`/app/${activeGroup?.id}/matches/${id}`) }
  if (loading && !match) return <section className="page"><LoadingState label="Ripristino Match Live…" /></section>
  if (error) return <section className="page"><ErrorState message={error} action={<Button onClick={() => void load()}>Riprova</Button>} /></section>
  if (!match) return <section className="page"><EmptyState title="Partita non disponibile" description="La partita non appartiene al WorkGroup attivo oppure non è accessibile." /></section>
  return <section className="page match-live-page"><header className="match-live-page-head"><div><p className="eyebrow">Modalità Matchday</p><h1>Live · vs {match.opponent}</h1></div><Button size="sm" variant="ghost" onClick={leave}><ArrowLeft size={16} />Esci dal Live</Button></header><MatchLivePanel match={match} editable={can('matches.edit')} onMatchChanged={next => setMatch(current => current?.status === next.status && current.ourScore === next.ourScore && current.opponentScore === next.opponentScore ? current : next)} /></section>
}

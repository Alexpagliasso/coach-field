import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, BarChart3, BookOpenCheck, Dumbbell, ShieldCheck, Trophy, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/authContext'
import { getCloudMatchPage } from '../cloud/matchCloudRepository'
import { getWorkGroupRoster } from '../cloud/playerCloudRepository'
import { getCloudTrainingSessionPage, getExerciseLibrary } from '../cloud/trainingCloudRepository'
import { useGroup } from '../groups/groupContext'
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState, PageHeader } from '../components/ui'

type DemoStats = { players: number; sessions: number; matches: number; exercises: number }

const emptyStats: DemoStats = { players: 0, sessions: 0, matches: 0, exercises: 0 }

export function DemoWelcomePage() {
  const { data, availableGroups } = useGroup()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState<DemoStats>(emptyStats)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [guideVisible, setGuideVisible] = useState(false)

  const access = data.demoViewerAccesses.find(item => item.userId === user?.id && item.active && item.role === 'demo_viewer')
  const organization = data.organizations.find(item => item.id === access?.organizationId)
  const groups = useMemo(() => availableGroups.filter(group => group.organizationId === organization?.id), [availableGroups, organization?.id])
  const season = data.organizationSeasons.find(item => item.organizationId === organization?.id && data.teams.some(team => team.organizationId === organization?.id && team.seasonId === item.id))
  const team = data.teams.find(item => item.organizationId === organization?.id && groups.some(group => group.teamId === item.id))

  const load = async () => {
    if (!organization || groups.length === 0) { setLoading(false); return }
    setLoading(true); setError('')
    try {
      const [rosters, sessions, matches, exercises] = await Promise.all([
        Promise.all(groups.map(group => getWorkGroupRoster(group.id))),
        Promise.all(groups.map(group => getCloudTrainingSessionPage(group.id, { page: 1, pageSize: 1 }))),
        Promise.all(groups.map(group => getCloudMatchPage(group.id, { page: 1, pageSize: 1 }))),
        getExerciseLibrary(organization.id),
      ])
      setStats({
        players: new Set(rosters.flat().map(entry => entry.player.id)).size,
        sessions: sessions.reduce((total, page) => total + page.total, 0),
        matches: matches.reduce((total, page) => total + page.total, 0),
        exercises: exercises.length,
      })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Non siamo riusciti a caricare i dati della demo.')
    } finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [organization?.id, groups.map(group => group.id).join(':')])

  if (!access || !organization) return <section className="page"><EmptyState title="Demo non disponibile" description="Questo account non ha un accesso Demo Viewer attivo." action={<Button onClick={() => navigate('/app/groups')}>Torna alle società</Button>} /></section>
  if (groups.length === 0) return <section className="page"><EmptyState title="Struttura demo non disponibile" description="Non troviamo gruppi demo a cui questo account possa accedere." /></section>
  const go = (suffix: 'dashboard' | 'players' | 'training' | 'matches') => navigate(`/app/${groups[0].id}/${suffix}`)

  return <main className="page mx-auto max-w-6xl pb-10">
    <PageHeader eyebrow="GrowPitch Demo · Sola lettura" title="Una società. Due gruppi. Tutto sotto controllo." description="Esplora una stagione calcistica completa, dalla pianificazione degli allenamenti alla gestione delle partite." />
    <Card className="mb-5 overflow-hidden border-app-primary/30 bg-[linear-gradient(135deg,rgba(89,64,255,.13),rgba(41,159,255,.08))]" padding="lg">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><Badge variant="primary">Dati inventati</Badge><h2 className="mt-3 text-xl font-bold">{organization.name}</h2><p className="mt-1 text-sm text-app-muted">{season?.name ?? 'Stagione demo'} · {team?.name ?? 'Categoria demo'}</p></div><div className="flex items-center gap-2 rounded-full border border-app-primary/20 bg-app-surface/80 px-3 py-2 text-sm font-semibold text-app-primary"><ShieldCheck size={17} />Demo · Sola lettura</div></div>
      <div className="mt-5 flex flex-wrap gap-2">{groups.map(group => <Button key={group.id} size="sm" variant="secondary" onClick={() => navigate(`/app/${group.id}/dashboard`)}>{group.name}</Button>)}</div>
    </Card>
    {loading ? <LoadingState label="Caricamento dati demo..." /> : error ? <ErrorState message={error} action={<Button size="sm" onClick={() => void load()}>Riprova</Button>} /> : <>
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Numeri demo"><Metric icon={Users} label="Giocatori" value={stats.players} /><Metric icon={Dumbbell} label="Allenamenti" value={stats.sessions} /><Metric icon={Trophy} label="Partite" value={stats.matches} /><Metric icon={BookOpenCheck} label="Esercizi" value={stats.exercises} /></section>
      <section className="mt-6 grid gap-3 sm:grid-cols-2" aria-label="Esplora la demo"><Destination icon={BarChart3} title="Dashboard" description="Consulta andamento, presenze e indicatori dei gruppi." onClick={() => go('dashboard')} /><Destination icon={Users} title="Rosa" description="Apri i profili e consulta convocazioni e presenze." onClick={() => go('players')} /><Destination icon={Dumbbell} title="Allenamenti" description="Esplora sedute, esercizi, obiettivi e appelli completati." onClick={() => go('training')} /><Destination icon={Trophy} title="Partite" description="Guarda convocazioni, formazione, Live e report finali." onClick={() => go('matches')} /></section>
      <section className="mt-6 rounded-app border border-app-border bg-app-surface p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="eyebrow">Guida rapida</p><h2 className="font-bold">Scopri il flusso della stagione</h2></div><Button size="sm" variant="ghost" onClick={() => setGuideVisible(value => !value)} aria-expanded={guideVisible}>{guideVisible ? 'Nascondi guida' : 'Apri guida'}</Button></div>{guideVisible && <ol className="mt-4 grid gap-3 sm:grid-cols-4"><GuideStep step="1" title="Dashboard" text="Leggi i dati dei due gruppi." onClick={() => go('dashboard')} /><GuideStep step="2" title="Rosa" text="Consulta ogni giocatore." onClick={() => go('players')} /><GuideStep step="3" title="Allenamenti" text="Rivedi programma e presenze." onClick={() => go('training')} /><GuideStep step="4" title="Partite" text="Apri risultati e report Live." onClick={() => go('matches')} /></ol>}</section>
    </>}
  </main>
}

function Metric({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) { return <Card padding="sm"><Icon className="size-4 text-app-primary" /><strong className="mt-2 block text-2xl tabular-nums">{value}</strong><span className="text-sm text-app-muted">{label}</span></Card> }
function Destination({ icon: Icon, title, description, onClick }: { icon: typeof Users; title: string; description: string; onClick: () => void }) { return <button type="button" onClick={onClick} className="rounded-app border border-app-border bg-app-surface p-4 text-left shadow-[var(--shadow-card)] transition hover:border-app-primary/60 hover:bg-app-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-app-primary"><Icon className="size-5 text-app-primary" /><h2 className="mt-3 font-bold">{title}</h2><p className="mt-1 text-sm leading-relaxed text-app-muted">{description}</p><span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-app-primary">Apri <ArrowRight size={15} /></span></button> }
function GuideStep({ step, title, text, onClick }: { step: string; title: string; text: string; onClick: () => void }) { return <li className="rounded-xl bg-app-elevated p-3"><span className="text-xs font-bold text-app-primary">{step}</span><h3 className="mt-1 font-semibold">{title}</h3><p className="mt-1 text-xs text-app-muted">{text}</p><Button size="sm" variant="ghost" className="mt-2" onClick={onClick}>Apri</Button></li> }

import { Link } from 'react-router-dom'
import { ArrowDown, ArrowRight, AudioLines, Check, ChevronRight, ClipboardCheck, CloudOff, Dumbbell, Eye, Gauge, Mic, NotebookPen, ShieldCheck, Smartphone, Sparkles, Target, TrendingUp, Users } from 'lucide-react'
import { APP_NAME } from '../brand'
import { Badge, Card, buttonClass } from '../components/ui'

const workflow = [
  [Eye, 'Osserva', 'Cattura ciò che succede realmente.'],
  [NotebookPen, 'Correggi', 'Registra l’intervento dell’allenatore.'],
  [Dumbbell, 'Allena', 'Trasforma il problema in lavoro sul campo.'],
  [ClipboardCheck, 'Verifica', 'Controlla se il comportamento cambia.'],
  [TrendingUp, 'Evolvi', 'Costruisci la storia della stagione.'],
] as const

const technology = [[CloudOff, 'Offline-first'], [Gauge, 'PWA'], [Smartphone, 'Mobile-first'], [AudioLines, 'Voice notes'], [ShieldCheck, 'Local data'], [Users, 'Role-based staff']] as const

function Heading({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return <div className="public-section-heading"><p>{eyebrow}</p><h2>{title}</h2><span>{text}</span></div>
}

function ObservationCard() {
  return <Card className="public-observation-card" padding="lg">
    <div className="flex items-center justify-between gap-3"><Badge variant="info"><Eye size={13} /> Osservazione</Badge><span className="public-demo-label"><Users size={14} /> Squadra</span></div>
    <p>“Poca personalità nella metà campo offensiva.”</p>
    <div className="flex flex-wrap gap-2"><Badge variant="info">Tattica</Badge><Badge variant="concern">Da monitorare</Badge></div>
  </Card>
}

function HeroMockup() {
  return <div className="public-hero-visual" aria-label="Anteprima dimostrativa di Coach Field">
    <div className="public-pitch-lines" aria-hidden="true" />
    <div className="public-score-panel"><div className="flex items-center justify-between gap-3"><span className="public-demo-label">Match day · U10</span><Badge variant="positive"><span className="public-live-dot" /> Live</Badge></div><div className="public-score"><span>Coach Field</span><strong>2—1</strong><span>Atletico</span></div><div className="public-match-time"><span>2° tempo</span><strong>08:42</strong></div></div>
    <ObservationCard />
    <Card className="public-player-card"><div className="public-avatar">A.</div><div><span className="public-demo-label">Apprendimento</span><strong>Andrea · Miglioramento dopo correzione</strong></div><Badge variant="positive">Migliorato ↑</Badge></Card>
  </div>
}

export function PublicHome() {
  return <div className="public-home">
    <a className="public-skip" href="#main-content">Vai al contenuto</a>
    <header className="public-nav"><div className="public-shell public-nav-inner"><a className="public-brand" href="#top" aria-label="Coach Field, torna all’inizio"><span>CF</span>{APP_NAME}</a><nav aria-label="Navigazione pubblica"><a href="#prodotto">Prodotto</a><a href="#metodo">Metodo</a><a href="#tecnologia">Tecnologia</a></nav><Link className={buttonClass({ variant: 'primary', size: 'sm' })} to="/login">Accedi <ArrowRight size={16} /></Link></div></header>
    <main id="main-content">
      <section className="public-hero public-shell" id="top"><div className="public-hero-copy"><div className="public-eyebrow"><span>{APP_NAME}</span><i /> Field intelligence for youth coaches</div><h1>Il campo ti dice<br /><em>cosa allenare.</em></h1><p className="public-hero-lead">Coach Field ti aiuta a ricordarlo.</p><p className="public-hero-sub">Pianifica. Osserva. Correggi.<br />Verifica l’evoluzione della tua squadra.</p><div className="public-hero-actions"><Link className={buttonClass({ variant: 'primary', size: 'lg' })} to="/login">Entra in Coach Field <ArrowRight size={18} /></Link><a className={buttonClass({ variant: 'secondary', size: 'lg' })} href="#metodo">Scopri come funziona <ArrowDown size={18} /></a></div><div className="public-trust"><span><Check /> Pensato per il campo</span><span><Check /> I tuoi dati restano tuoi</span></div></div><HeroMockup /></section>

      <section className="public-method" id="metodo"><div className="public-shell"><Heading eyebrow="Dal campo al percorso" title="Ogni dettaglio diventa evoluzione." text="Un metodo semplice per trasformare quello che vedi in lavoro utile, verificabile e condiviso." /><div className="public-workflow">{workflow.map(([Icon, title, text], index) => <div className="public-workflow-step" key={title}><div className="public-step-icon"><Icon /></div><span>0{index + 1}</span><h3>{title}</h3><p>{text}</p>{index < workflow.length - 1 && <ChevronRight className="public-step-arrow" aria-hidden="true" />}</div>)}</div></div></section>

      <section className="public-feature public-shell" id="prodotto"><div className="public-feature-copy"><Heading eyebrow="Match day" title="Vedi. Annoti. Continui ad allenare." text="Pochi tocchi, informazioni chiare. Coach Field è progettato per stare in mano mentre la partita continua davanti a te." /><ul><li><Check /> Squadra o giocatore</li><li><Check /> Scrivi o registra</li><li><Check /> Salva e torna al campo</li></ul></div><div className="public-phone-wrap"><div className="public-phone"><div className="public-phone-top"><span>09:41</span><strong>COACH FIELD</strong><span>●●●</span></div><div className="public-phone-body"><Badge variant="positive">Live · 2° tempo</Badge><h3>Nuova osservazione</h3><div className="public-segment"><strong>Squadra</strong><span>Giocatore</span></div><label>Osservazione</label><div className="public-fake-input">Poca ampiezza in costruzione…</div><div className="public-phone-actions"><span><Mic /> Registra</span><strong>Salva <ArrowRight /></strong></div></div></div><div className="public-phone-note"><Sparkles /><span><strong>3 secondi</strong> per catturare un dettaglio.</span></div></div></section>

      <section className="public-feature public-feature-alt"><div className="public-shell public-feature-grid"><div className="public-training-board"><div className="public-board-header"><div><span className="public-demo-label">Training · Sessione 18</span><h3>Uscita dalla pressione</h3></div><Badge variant="primary">Oggi</Badge></div><div className="public-exercise"><span>01</span><div><strong>Rondo direzionale 6v3</strong><p>Focus · orientamento e sostegno</p></div><Target /></div><div className="public-exercise active"><span>02</span><div><strong>Partita a tema</strong><p>Risposta alla correzione · positiva</p></div><TrendingUp /></div><ObservationCard /></div><div className="public-feature-copy"><Heading eyebrow="Training" title="Ogni allenamento parte da ciò che hai visto." text="Sessioni, esercizi e focus restano collegati alle evidenze del campo. Meno memoria dispersa, più intenzione." /></div></div></section>

      <section className="public-feature public-shell public-development"><div className="public-feature-copy"><Heading eyebrow="Player development" title="Non solo voti. Una storia di sviluppo." text="Obiettivi, evidenze e correzioni raccontano come un giocatore risponde al lavoro nel tempo." /></div><Card className="public-journey-card" padding="lg"><div className="public-journey-person"><div className="public-avatar">M.</div><div><span className="public-demo-label">Percorso individuale</span><h3>Giocatore M.</h3></div><Badge variant="positive">In crescita</Badge></div><div className="public-journey-line">{['Obiettivo', 'Evidenza', 'Correzione', 'Progresso'].map((item, index) => <div key={item}><span>{index + 1}</span><strong>{item}</strong>{index < 3 && <ArrowRight />}</div>)}</div><p>“Riceve orientato e trova più rapidamente il compagno libero.”</p></Card></section>

      <section className="public-tech" id="tecnologia"><div className="public-shell"><Heading eyebrow="Built for the touchline" title="Tecnologia che sparisce. Il campo resta." text="Veloce, installabile e costruita per il lavoro quotidiano di uno staff tecnico." /><div className="public-tech-grid">{technology.map(([Icon, label]) => <div key={label}><Icon /><span>{label}</span></div>)}</div></div></section>
      <section className="public-final-cta public-shell"><div><span className="public-demo-label">Il prossimo allenamento parte da qui.</span><h2>Osserva meglio.<br />Allena con intenzione.</h2></div><Link className={buttonClass({ variant: 'primary', size: 'lg' })} to="/login">Entra in Coach Field <ArrowRight /></Link></section>
    </main>
    <footer className="public-footer"><div className="public-shell"><div><strong>{APP_NAME}</strong><p>Train. Observe. Improve.</p></div><span>Designed &amp; developed by Alex Pagliasso</span></div></footer>
  </div>
}

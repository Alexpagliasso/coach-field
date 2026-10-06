import { useState } from 'react'
import { Activity, ArrowLeft, Check, CircleAlert, Info, LogOut, Palette, Plus, Radio, ShieldAlert, Sparkles, Trophy } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/authContext'
import { Badge, Button, Card, Field, IconButton, Input, PageHeader, Textarea, buttonClass } from '../components/ui'
import { ThemeSelectorSheet } from '../components/ThemeSelectorSheet'

const swatches = [
  ['Background', 'var(--bg)'], ['Surface', 'var(--surface)'], ['Elevated', 'var(--surface-raised)'], ['Border', 'var(--border)'],
  ['Primary', 'var(--primary)'], ['Accent', 'var(--accent)'], ['Success', 'var(--success)'], ['Warning', 'var(--warning)'], ['Danger', 'var(--danger)'], ['Info', 'var(--info)'],
]

export function UiLabPage() {
  const [themeOpen, setThemeOpen] = useState(false)
  const { signOut } = useAuth()
  return <main className="ui-lab min-h-screen text-app-text">
    <header className="ui-lab-bar"><Link className={buttonClass({ variant: 'ghost', size: 'sm' })} to="/app/groups"><ArrowLeft size={17} /> Gruppi</Link><strong>Coach Field · UI Lab</strong><div className="flex gap-2"><IconButton label="Cambia tema" onClick={() => setThemeOpen(true)}><Palette size={19} /></IconButton><IconButton label="Esci" onClick={() => void signOut()}><LogOut size={19} /></IconButton></div></header>
    <div className="ui-lab-container">
      <PageHeader eyebrow="Visual foundation 01" title="Sport-tech, leggibile, pronto per il campo." description="Token semantici e componenti essenziali per evolvere Coach Field senza riscrivere l'app." actions={<Button variant="primary"><Sparkles size={18} /> Azione primaria</Button>} />

      <section className="ui-lab-section"><div><p className="ui-kicker">Color system</p><h2 className="ui-section-title">Palette semantica</h2></div><div className="ui-swatch-grid">{swatches.map(([label, color]) => <Card key={label} className="ui-swatch"><span style={{ background: color }} /><strong>{label}</strong><small>{color}</small></Card>)}</div></section>

      <section className="ui-lab-grid">
        <Card padding="lg"><p className="ui-kicker">Typography</p><p className="ui-display">Match day.</p><h1 className="ui-page-title">Titolo pagina</h1><h2 className="ui-section-title">Titolo sezione</h2><h3 className="ui-card-title">Titolo card</h3><p className="ui-body">Testo principale leggibile durante l’attività sul campo.</p><p className="ui-secondary">Informazione secondaria e metadati.</p><p className="ui-caption">CAPTION · 12:45</p><p className="ui-metric">87%</p></Card>
        <Card padding="lg"><p className="ui-kicker">Actions</p><div className="flex flex-wrap gap-3"><Button variant="primary"><Plus size={18} /> Primary</Button><Button>Secondary</Button><Button variant="ghost">Ghost</Button><Button variant="danger"><ShieldAlert size={18} /> Danger</Button></div><div className="mt-5 flex flex-wrap gap-3"><Button size="sm">Small</Button><Button size="md">Medium</Button><Button size="lg">Large</Button><IconButton label="Conferma"><Check size={19} /></IconButton><Button disabled>Disabled</Button></div></Card>
        <Card padding="lg"><p className="ui-kicker">Status</p><div className="flex flex-wrap gap-2"><Badge>Neutro</Badge><Badge variant="primary">Attivo</Badge><Badge variant="positive"><Check size={13} /> Positivo</Badge><Badge variant="warning"><CircleAlert size={13} /> Attenzione</Badge><Badge variant="concern"><Activity size={13} /> Da monitorare</Badge><Badge variant="danger"><ShieldAlert size={13} /> Criticità</Badge><Badge variant="info"><Info size={13} /> Info</Badge></div></Card>
        <Card padding="lg"><p className="ui-kicker">Form controls</p><div className="grid gap-4"><Field label="Titolo" hint="Informazione di supporto"><Input placeholder="Nome dell'attività" /></Field><Field label="Osservazione"><Textarea placeholder="Cosa hai appena visto?" /></Field></div></Card>
      </section>

      <section className="ui-lab-section"><div><p className="ui-kicker">Product preview</p><h2 className="ui-section-title">Composizione sport-tech</h2></div><div className="ui-demo-grid">
        <Card className="ui-score-card" padding="lg"><div className="flex items-center justify-between"><Badge variant="danger"><Radio size={13} /> Live</Badge><Trophy className="text-app-primary" size={25} /></div><p className="ui-caption">MATCH DAY · U10</p><h3>Coach Field U10</h3><div className="ui-score"><strong>2</strong><span>—</span><strong>1</strong></div><p className="ui-secondary">Avversario</p></Card>
        <Card className="ui-observation-card" padding="lg"><div className="flex items-center justify-between gap-3"><div><p className="ui-kicker">Nuova osservazione</p><h3>Squadra</h3></div><Badge variant="primary">Inbox</Badge></div><blockquote>“Poca personalità nella metà campo offensiva.”</blockquote><div className="flex flex-wrap gap-2"><Badge variant="info">Tattica</Badge><Badge variant="concern"><Activity size={13} /> Da monitorare</Badge></div><Button className="mt-auto" variant="primary">Rivedi osservazione</Button></Card>
      </div></section>
    </div>
    {themeOpen && <ThemeSelectorSheet onClose={() => setThemeOpen(false)} />}
  </main>
}

import { useRef, useState } from 'react'
import { ArrowRight, Building2, Plus, Users, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/authContext'
import { useGroup } from '../groups/groupContext'
import { bootstrapOrganization } from '../cloud/staffRepository'
import { errorMessage } from '../lib/supabase'
import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, PageHeader } from '../components/ui'

export function OrganizationHubPage() {
  const { data, reload } = useGroup()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)
  const ids = new Set([...data.organizationMemberships.filter(item => item.userId === user?.id && item.active).map(item => item.organizationId), ...data.memberships.filter(item => item.userId === user?.id && item.active).map(item => item.organizationId)])
  const organizations = data.organizations.filter(item => ids.has(item.id))
  const create = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (lock.current) return
    const name = String(new FormData(event.currentTarget).get('name')).trim()
    if (!name) { setError('Inserisci il nome della società.'); return }
    lock.current = true; setBusy(true); setError('')
    try { const organization = await bootstrapOrganization(name); await reload(); setOpen(false); navigate(`/app/organizations/${organization.id}`) }
    catch (reason) { setError(errorMessage(reason)) }
    finally { lock.current = false; setBusy(false) }
  }

  return <main className="gp-hub hierarchy-page organization-command-hub"><PageHeader eyebrow="Command center" title="Le tue società" description="Scegli l’organizzazione per entrare nella sua struttura sportiva, dalle stagioni ai gruppi di lavoro." actions={<Button variant="primary" onClick={() => { setOpen(true); setError('') }}><Plus size={18} />Nuova società</Button>} />
    {organizations.length === 0 ? <EmptyState icon={Building2} title="Nessuna società disponibile" description="Crea la tua prima società per iniziare a strutturare stagioni, categorie e WorkGroup." action={<Button variant="primary" onClick={() => setOpen(true)}>Crea società</Button>} /> : <div className="gp-visual-grid">{organizations.map(organization => {
      const seasons = data.organizationSeasons.filter(item => item.organizationId === organization.id).length
      const teams = data.teams.filter(item => item.organizationId === organization.id).length
      const groups = data.groups.filter(item => item.organizationId === organization.id).length
      const admin = data.organizationMemberships.some(item => item.organizationId === organization.id && item.userId === user?.id && item.active)
      return <Card key={organization.id} className="gp-org-card command-hub-card" padding="lg"><div className="gp-cover"><span>GP</span><Badge variant={admin ? 'primary' : 'neutral'}>{admin ? 'Amministratore' : 'Staff'}</Badge></div><div><p className="eyebrow">Società sportiva</p><h2>{organization.name}</h2></div><dl className="command-card-metrics"><div><dt>Stagioni</dt><dd>{seasons}</dd></div><div><dt>Categorie</dt><dd>{teams}</dd></div><div><dt>WorkGroup</dt><dd>{groups}</dd></div></dl><Button variant="primary" onClick={() => navigate(`/app/organizations/${organization.id}`)}>Apri società <ArrowRight size={17} /></Button></Card>
    })}</div>}
    <p className="hierarchy-footnote"><Users size={16} />Sono mostrate solo le società accessibili al tuo account.</p>
    {open && <div className="sheet-backdrop" role="presentation"><section className="add-player-sheet" role="dialog" aria-modal="true" aria-labelledby="new-organization-title"><div className="sheet-handle" /><header className="exercise-sheet-header"><div><span className="eyebrow">Nuovo contesto</span><h1 id="new-organization-title">Nuova società</h1><p className="mt-2 text-sm text-app-muted">Crea il livello principale della struttura GrowPitch.</p></div><button className="icon-button" onClick={() => setOpen(false)} disabled={busy} aria-label="Chiudi"><X /></button></header><form className="add-player-scroll" onSubmit={create}><Field label="Nome società"><Input name="name" required autoFocus disabled={busy} maxLength={120} /></Field>{error && <ErrorState message={error} />}<div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Annulla</Button><Button variant="primary" loading={busy}>Crea società</Button></div></form></section></div>}
  </main>
}

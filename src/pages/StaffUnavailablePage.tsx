import { Users } from 'lucide-react'
import { Link } from '../groups/navigation'
import { Button, EmptyState } from '../components/ui'

export function StaffUnavailablePage() {
  return <section className="page grid gap-6"><EmptyState icon={Users} title="Sezione Staff non ancora disponibile" description="La gestione dello staff sarà disponibile in un prossimo aggiornamento." action={<Link to="/dashboard"><Button variant="primary">Torna alla Dashboard</Button></Link>} /></section>
}

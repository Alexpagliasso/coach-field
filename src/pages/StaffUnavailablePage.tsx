import { Users } from 'lucide-react'
import { useAuth } from '../auth/authContext'
import { OrganizationStaffDirectory } from '../components/OrganizationStaffDirectory'
import { Link } from '../groups/navigation'
import { Button, EmptyState } from '../components/ui'
import { useGroup } from '../groups/groupContext'

export function StaffUnavailablePage() {
  const { user } = useAuth()
  const { activeGroup, data } = useGroup()
  const organization = data.organizations.find(item => item.id === activeGroup?.organizationId)
  const admin = Boolean(organization && data.organizationMemberships.some(item => item.organizationId === organization.id && item.userId === user?.id && item.active && item.role === 'admin'))

  if (!organization || !admin) return <section className="page grid gap-6"><EmptyState icon={Users} title="Gestione staff non disponibile" description="Solo un amministratore della società può gestire anagrafiche, assegnazioni e collegamenti account." action={<Link to="/dashboard"><Button variant="primary">Torna alla Dashboard</Button></Link>} /></section>

  return <section className="page"><OrganizationStaffDirectory organizationId={organization.id} organizationName={organization.name} groups={data.groups.filter(group => group.organizationId === organization.id)} /></section>
}

import { useState } from 'react'
import { Link2 } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { acceptStaffAccountLink } from '../cloud/staffRepository'
import { Button, Card, ErrorState } from '../components/ui'
import { useGroup } from '../groups/groupContext'
import { errorMessage } from '../lib/supabase'

export function StaffLinkAcceptancePage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const { reload } = useGroup()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const accept = async () => {
    if (!token || busy) return
    setBusy(true); setError('')
    try { await acceptStaffAccountLink(token); await reload(); navigate('/app/groups', { replace: true }) }
    catch (reason) { setError(errorMessage(reason)) } finally { setBusy(false) }
  }
  return <main className="page mx-auto max-w-xl"><Card className="grid gap-4" padding="lg"><Link2 className="text-app-primary" size={32} /><div><p className="eyebrow">Collegamento staff</p><h1 className="text-2xl font-bold">Accetta accesso GrowPitch</h1><p className="mt-2 text-app-muted">Collega il tuo account autenticato all’anagrafica staff e attiva esclusivamente i WorkGroup assegnati.</p></div>{!token && <ErrorState message="Link di collegamento mancante o non valido." />}{error && <ErrorState message={error} />}<Button variant="primary" loading={busy} disabled={!token} onClick={() => void accept()}>Accetta collegamento</Button></Card></main>
}

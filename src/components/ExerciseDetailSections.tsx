import type { ReactNode } from 'react'
import { Badge } from './ui'

type Props = {
  title: string
  headingId?: string
  headingLevel?: 'h1' | 'h2'
  category?: string | null
  tags?: string[]
  objective?: string | null
  durationMinutes?: number | null
  playerCount?: number | null
  fieldWidthM?: number | null
  fieldLengthM?: number | null
  materials?: string[]
  shortDescription?: string | null
  detailedDescription?: string | null
  coachNotes?: string | null
  media?: ReactNode
  actions?: ReactNode
}

const normalized = (value?: string | null) => value?.trim().replace(/\s+/g, ' ').toLocaleLowerCase('it-IT') ?? ''

export function ExerciseDetailSections({ title, headingId, headingLevel = 'h2', category, tags = [], objective, durationMinutes, playerCount, fieldWidthM, fieldLengthM, materials = [], shortDescription, detailedDescription, coachNotes, media, actions }: Props) {
  const Heading = headingLevel
  const short = shortDescription?.trim()
  const detailed = detailedDescription?.trim()
  const distinctDetailed = detailed && normalized(detailed) !== normalized(short) ? detailed : undefined
  const hasOrganization = Boolean(durationMinutes || playerCount || (fieldWidthM && fieldLengthM) || materials.length)
  const hasDescription = Boolean(short || distinctDetailed)

  return <div className="exercise-detail-sections">
    {media}
    <header className="exercise-detail-identity">
      {(category || tags.length > 0) && <div className="exercise-detail-meta">{category && <Badge>{category}</Badge>}{tags.map(tag => <Badge key={tag} variant="info">{tag}</Badge>)}</div>}
      <Heading id={headingId}>{title}</Heading>
    </header>
    {objective?.trim() && <section className="exercise-detail-objective"><h3>Obiettivo</h3><p>{objective.trim()}</p></section>}
    {hasOrganization && <section className="exercise-detail-section"><h3>Organizzazione</h3><div className="exercise-detail-facts">{durationMinutes ? <span><strong>Durata</strong>{durationMinutes} min</span> : null}{playerCount ? <span><strong>Giocatori</strong>{playerCount}</span> : null}{fieldWidthM && fieldLengthM ? <span><strong>Campo</strong>{fieldWidthM} × {fieldLengthM} m</span> : null}{materials.length > 0 ? <span className="is-wide"><strong>Materiali</strong>{materials.join(', ')}</span> : null}</div></section>}
    {hasDescription && <section className="exercise-detail-section"><h3>Svolgimento</h3>{short && <p>{short}</p>}{distinctDetailed && <p>{distinctDetailed}</p>}</section>}
    {coachNotes?.trim() && <section className="exercise-detail-section exercise-detail-coach"><h3>Note dell’allenatore</h3><p>{coachNotes.trim()}</p></section>}
    {actions && <div className="exercise-detail-actions">{actions}</div>}
  </div>
}

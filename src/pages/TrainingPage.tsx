import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Copy, Plus, Search, Trash2 } from 'lucide-react'
import { createTrainingSessionFromScratch, createTrainingSessionFromTemplate, getTrainingSessions } from '../db/sessionsRepository'
import { createTrainingTemplate, deleteTrainingTemplate, duplicateTrainingTemplate, getTrainingTemplates, updateTrainingTemplate } from '../db/trainingTemplatesRepository'
import type { TrainingSession, TrainingSessionPhase, TrainingTemplate, TrainingTemplatePhase } from '../types/domain'
import { makeId } from '../db/db'
import { isToday, sessionDateLabel } from '../utils/training'

type TemplateFormProps = {
  template?: TrainingTemplate
  onSaved: () => void
  onClose: () => void
}

type SessionFormProps = {
  template?: TrainingTemplate
  onSaved: (session: TrainingSession) => void
  onClose: () => void
}

const emptyPhase = (order: number): TrainingTemplatePhase => ({
  id: makeId(),
  title: `Fase ${order}`,
  durationMinutes: 10,
  order,
  notes: '',
})

function splitTags(value: string) {
  return value.split(',').map((tag) => tag.trim()).filter(Boolean)
}

function TemplateForm({ template, onSaved, onClose }: TemplateFormProps) {
  const [title, setTitle] = useState(template?.title ?? '')
  const [description, setDescription] = useState(template?.description ?? '')
  const [duration, setDuration] = useState(template?.expectedDurationMinutes ?? 90)
  const [minPlayers, setMinPlayers] = useState(template?.minPlayers?.toString() ?? '')
  const [maxPlayers, setMaxPlayers] = useState(template?.maxPlayers?.toString() ?? '')
  const [tags, setTags] = useState((template?.tags ?? []).join(', '))
  const [phases, setPhases] = useState<TrainingTemplatePhase[]>(template?.phases ?? [emptyPhase(1)])
  const [error, setError] = useState('')

  const updatePhase = (id: string, patch: Partial<TrainingTemplatePhase>) => {
    setPhases((current) => current.map((phase) => phase.id === id ? { ...phase, ...patch } : phase))
  }

  const movePhase = (id: string, direction: -1 | 1) => {
    setPhases((current) => {
      const index = current.findIndex((phase) => phase.id === id)
      const nextIndex = index + direction
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current
      const next = [...current]
      const [phase] = next.splice(index, 1)
      next.splice(nextIndex, 0, phase)
      return next.map((item, itemIndex) => ({ ...item, order: itemIndex + 1 }))
    })
  }

  const save = async () => {
    setError('')
    if (!title.trim()) {
      setError('Titolo obbligatorio.')
      return
    }
    const input = {
      title,
      description,
      expectedDurationMinutes: Number(duration) || 90,
      minPlayers: minPlayers ? Number(minPlayers) : undefined,
      maxPlayers: maxPlayers ? Number(maxPlayers) : undefined,
      tags: splitTags(tags),
      phases: phases.map((phase, index) => ({ ...phase, order: index + 1, durationMinutes: Number(phase.durationMinutes) || 0 })),
    }
    if (template) await updateTrainingTemplate(template.id, input)
    else await createTrainingTemplate(input)
    onSaved()
    onClose()
  }

  return (
    <div className="sheet-backdrop" role="presentation" onClick={onClose}>
      <section className="training-form-sheet" role="dialog" aria-modal="true" aria-labelledby="template-form-title" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-handle" />
        <header className="exercise-sheet-header">
          <div>
            <span className="eyebrow">Template allenamento</span>
            <h1 id="template-form-title">{template ? 'Modifica template' : 'Nuovo template'}</h1>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Chiudi template">×</button>
        </header>
        <div className="add-player-scroll">
          <label className="form-field"><span>Titolo *</span><input value={title} onChange={(event) => setTitle(event.target.value)} autoFocus /></label>
          <label className="form-field"><span>Descrizione</span><textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
          <div className="score-grid">
            <label className="form-field"><span>Durata prevista</span><input type="number" min="1" value={duration} onChange={(event) => setDuration(Number(event.target.value))} /></label>
            <label className="form-field"><span>Tag</span><input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="Tecnica, Possesso" /></label>
          </div>
          <div className="score-grid">
            <label className="form-field"><span>Min giocatori</span><input type="number" min="0" value={minPlayers} onChange={(event) => setMinPlayers(event.target.value)} /></label>
            <label className="form-field"><span>Max giocatori</span><input type="number" min="0" value={maxPlayers} onChange={(event) => setMaxPlayers(event.target.value)} /></label>
          </div>
          <section className="content-section">
            <div className="section-header-row">
              <h2>Fasi</h2>
              <button type="button" onClick={() => setPhases((current) => [...current, emptyPhase(current.length + 1)])}><Plus size={18} />Fase</button>
            </div>
            {phases.map((phase, index) => (
              <article key={phase.id} className="list-card training-phase-editor">
                <div>
                  <label className="form-field"><span>Titolo</span><input value={phase.title} onChange={(event) => updatePhase(phase.id, { title: event.target.value })} /></label>
                  <label className="form-field"><span>Durata</span><input type="number" min="0" value={phase.durationMinutes} onChange={(event) => updatePhase(phase.id, { durationMinutes: Number(event.target.value) })} /></label>
                  <label className="form-field"><span>Note</span><textarea rows={2} value={phase.notes ?? ''} onChange={(event) => updatePhase(phase.id, { notes: event.target.value })} /></label>
                </div>
                <div className="vertical-actions">
                  <button type="button" onClick={() => movePhase(phase.id, -1)} disabled={index === 0}>↑</button>
                  <button type="button" onClick={() => movePhase(phase.id, 1)} disabled={index === phases.length - 1}>↓</button>
                  <button type="button" className="danger" onClick={() => setPhases((current) => current.filter((item) => item.id !== phase.id))}><Trash2 size={18} /></button>
                </div>
              </article>
            ))}
          </section>
          {error && <p className="form-error">{error}</p>}
        </div>
        <footer className="sheet-footer"><button type="button" className="primary-action" onClick={save}>Salva template</button></footer>
      </section>
    </div>
  )
}

function SessionForm({ template, onSaved, onClose }: SessionFormProps) {
  const [title, setTitle] = useState(template?.title ?? 'Allenamento')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [startTime, setStartTime] = useState('')
  const [duration, setDuration] = useState(template?.expectedDurationMinutes ?? 90)
  const [phases, setPhases] = useState<TrainingSessionPhase[]>(template
    ? template.phases.map((phase) => ({ id: makeId(), title: phase.title, order: phase.order, plannedDurationMinutes: phase.durationMinutes, exerciseId: phase.exerciseId, exerciseSnapshot: phase.exerciseSnapshot, status: 'planned', coachNotes: phase.notes }))
    : [{ id: makeId(), title: 'Fase 1', order: 1, plannedDurationMinutes: 10, status: 'planned' }])
  const [error, setError] = useState('')

  const save = async () => {
    setError('')
    if (!title.trim()) {
      setError('Titolo obbligatorio.')
      return
    }
    const session = template
      ? await createTrainingSessionFromTemplate(template.id, date, startTime)
      : await createTrainingSessionFromScratch({ title, date, startTime, durationMinutes: Number(duration) || 90, plannedPhases: phases, generalNotes: '', takeaways: '' })
    onSaved(session)
    onClose()
  }

  return (
    <div className="sheet-backdrop" role="presentation" onClick={onClose}>
      <section className="training-form-sheet" role="dialog" aria-modal="true" aria-labelledby="session-form-title" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-handle" />
        <header className="exercise-sheet-header">
          <div>
            <span className="eyebrow">{template ? 'Da template' : 'Da zero'}</span>
            <h1 id="session-form-title">Crea allenamento</h1>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Chiudi allenamento">×</button>
        </header>
        <div className="add-player-scroll">
          <label className="form-field"><span>Titolo</span><input value={title} onChange={(event) => setTitle(event.target.value)} disabled={Boolean(template)} /></label>
          <div className="score-grid">
            <label className="form-field"><span>Data</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
            <label className="form-field"><span>Orario</span><input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></label>
          </div>
          {!template && (
            <>
              <label className="form-field"><span>Durata</span><input type="number" min="1" value={duration} onChange={(event) => setDuration(Number(event.target.value))} /></label>
              <section className="content-section">
                <div className="section-header-row">
                  <h2>Fasi</h2>
                  <button type="button" onClick={() => setPhases((current) => [...current, { id: makeId(), title: `Fase ${current.length + 1}`, order: current.length + 1, plannedDurationMinutes: 10, status: 'planned' }])}><Plus size={18} />Fase</button>
                </div>
                {phases.map((phase) => (
                  <article key={phase.id} className="list-card">
                    <div>
                      <label className="form-field"><span>Titolo</span><input value={phase.title} onChange={(event) => setPhases((current) => current.map((item) => item.id === phase.id ? { ...item, title: event.target.value } : item))} /></label>
                      <label className="form-field"><span>Durata</span><input type="number" min="0" value={phase.plannedDurationMinutes ?? 0} onChange={(event) => setPhases((current) => current.map((item) => item.id === phase.id ? { ...item, plannedDurationMinutes: Number(event.target.value) } : item))} /></label>
                    </div>
                    <button type="button" className="danger" onClick={() => setPhases((current) => current.filter((item) => item.id !== phase.id).map((item, index) => ({ ...item, order: index + 1 })))}><Trash2 size={18} /></button>
                  </article>
                ))}
              </section>
            </>
          )}
          {error && <p className="form-error">{error}</p>}
        </div>
        <footer className="sheet-footer"><button type="button" className="primary-action" onClick={save}>Crea allenamento</button></footer>
      </section>
    </div>
  )
}

export function TrainingPage() {
  const [sessions, setSessions] = useState<TrainingSession[]>([])
  const [templates, setTemplates] = useState<TrainingTemplate[]>([])
  const [query, setQuery] = useState('')
  const [templateForm, setTemplateForm] = useState<TrainingTemplate | 'new'>()
  const [sessionForm, setSessionForm] = useState<TrainingTemplate | 'scratch'>()
  const navigate = useNavigate()

  const refresh = async () => {
    const [loadedSessions, loadedTemplates] = await Promise.all([getTrainingSessions(), getTrainingTemplates()])
    setSessions(loadedSessions)
    setTemplates(loadedTemplates)
  }

  useEffect(() => {
    let cancelled = false
    Promise.all([getTrainingSessions(), getTrainingTemplates()]).then(([loadedSessions, loadedTemplates]) => {
      if (cancelled) return
      setSessions(loadedSessions)
      setTemplates(loadedTemplates)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const filteredTemplates = useMemo(() => templates.filter((template) => {
    const text = `${template.title} ${template.tags.join(' ')}`.toLowerCase()
    return text.includes(query.toLowerCase())
  }), [query, templates])
  const upcoming = sessions.filter((session) => session.status !== 'completed')
  const past = sessions.filter((session) => session.status === 'completed')
  const today = sessions.find((session) => isToday(session.date))

  return (
    <section className="page">
      <header className="page-header compact">
        <span className="eyebrow">Allenamenti</span>
        <h1>Training</h1>
        <p>{sessions.length} sessioni · {templates.length} template</p>
      </header>

      <section className="content-section training-today">
        <div>
          <span className="eyebrow">Prossimo / Oggi</span>
          <strong>{today ? today.title : 'Nessun allenamento oggi'}</strong>
          {today && <span>{today.startTime || 'Orario libero'} · {today.durationMinutes} min</span>}
        </div>
        {today ? <Link className="primary-action" to={`/training/${today.id}`}>Apri sessione</Link> : <button type="button" className="primary-action" onClick={() => setSessionForm('scratch')}><Plus size={22} />Crea allenamento</button>}
      </section>

      <div className="action-row">
        <button type="button" onClick={() => setSessionForm('scratch')}><Plus size={20} />Da zero</button>
        <button type="button" onClick={() => setTemplateForm('new')}><Plus size={20} />Nuovo template</button>
      </div>

      <section className="content-section">
        <h2>Prossimi</h2>
        <div className="list-stack">
          {upcoming.map((session) => <TrainingSessionCard key={session.id} session={session} />)}
          {upcoming.length === 0 && <p className="empty-state">Nessun allenamento registrato.</p>}
        </div>
      </section>

      <section className="content-section">
        <h2>Storico</h2>
        <div className="list-stack">
          {past.map((session) => <TrainingSessionCard key={session.id} session={session} />)}
          {past.length === 0 && <p className="empty-state">Nessun allenamento completato.</p>}
        </div>
      </section>

      <section className="content-section">
        <div className="section-header-row">
          <h2>Template allenamento</h2>
          <button type="button" onClick={() => setTemplateForm('new')}><Plus size={18} />Nuovo</button>
        </div>
        <label className="search-field">
          <Search size={21} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cerca template..." />
        </label>
        <div className="list-stack">
          {filteredTemplates.map((template) => (
            <article key={template.id} className="list-card template-card">
              <div>
                <strong>{template.title}</strong>
                <span>{template.expectedDurationMinutes} min · {template.phases.length} fasi</span>
                {(template.minPlayers || template.maxPlayers) && <small>{template.minPlayers ?? '—'}–{template.maxPlayers ?? '—'} giocatori</small>}
                <div className="template-tags">{template.tags.map((tag) => <b key={tag}>{tag}</b>)}</div>
              </div>
              <div className="vertical-actions">
                <button type="button" onClick={() => setSessionForm(template)}>Usa template</button>
                <button type="button" onClick={() => setTemplateForm(template)}>Modifica</button>
                <button type="button" onClick={async () => { await duplicateTrainingTemplate(template.id); refresh() }}><Copy size={18} />Duplica</button>
                <button type="button" className="danger" onClick={async () => { if (window.confirm('Eliminare questo template? Le sessioni create non verranno eliminate.')) { await deleteTrainingTemplate(template.id); refresh() } }}><Trash2 size={18} /></button>
              </div>
            </article>
          ))}
          {filteredTemplates.length === 0 && <p className="empty-state">Nessun template ancora. Salva i tuoi allenamenti migliori e riutilizzali.</p>}
        </div>
      </section>

      {templateForm && <TemplateForm template={templateForm === 'new' ? undefined : templateForm} onSaved={refresh} onClose={() => setTemplateForm(undefined)} />}
      {sessionForm && <SessionForm template={sessionForm === 'scratch' ? undefined : sessionForm} onSaved={(session) => { refresh(); navigate(`/training/${session.id}`) }} onClose={() => setSessionForm(undefined)} />}
    </section>
  )
}

function TrainingSessionCard({ session }: { session: TrainingSession }) {
  const completed = session.status === 'completed'
  return (
    <Link to={`/training/${session.id}`} className="list-card training-session-card">
      <time>{sessionDateLabel(session.date)}</time>
      <div>
        <strong>{session.title}</strong>
        <span>{session.startTime || 'Orario libero'} · {session.durationMinutes} min</span>
        <small>{session.plannedPhases?.length ?? session.phases?.length ?? 0} fasi</small>
      </div>
      <b className={completed ? 'status-badge complete' : 'status-badge'}>{completed ? 'COMPLETATO' : 'PIANIFICATO'}</b>
    </Link>
  )
}

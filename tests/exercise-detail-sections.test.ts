import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ExerciseDetailSections } from '../src/components/ExerciseDetailSections'

const render = (props: Parameters<typeof ExerciseDetailSections>[0]) => renderToStaticMarkup(createElement(ExerciseDetailSections, props))

describe('exercise detail sections', () => {
  it('renders complete real data in the requested hierarchy', () => {
    const html = render({ title: 'Rondo', category: 'Tecnica', objective: 'Possesso', durationMinutes: 12, playerCount: 8, fieldWidthM: 18, fieldLengthM: 24, materials: ['Cinesini', 'Palloni'], shortDescription: 'Prima fase', detailedDescription: 'Seconda fase\nCon pressione', coachNotes: 'Correggere il corpo', media: createElement('img', { src: 'cover.jpg', alt: '' }) })
    for (const value of ['Rondo', 'Obiettivo', 'Possesso', 'Organizzazione', '12 min', '8', '18 × 24 m', 'Cinesini, Palloni', 'Svolgimento', 'Prima fase', 'Seconda fase\nCon pressione', 'Note dell’allenatore']) expect(html).toContain(value)
    expect(html.indexOf('cover.jpg')).toBeLessThan(html.indexOf('Rondo'))
    expect(html.indexOf('Rondo')).toBeLessThan(html.indexOf('Obiettivo'))
  })

  it('omits unavailable sections for partial and legacy exercises', () => {
    const html = render({ title: 'Corsa libera', detailedDescription: 'Corri mantenendo le distanze.' })
    expect(html).toContain('Svolgimento')
    expect(html).not.toContain('Obiettivo')
    expect(html).not.toContain('Organizzazione')
    expect(html).not.toContain('Note dell’allenatore')
    expect(html).not.toContain('<img')
  })

  it('does not duplicate equivalent short and detailed descriptions', () => {
    const html = render({ title: 'Passaggi', shortDescription: 'Tre passaggi e movimento', detailedDescription: '  tre   passaggi e movimento ' })
    expect(html.match(/Tre passaggi e movimento/gi)).toHaveLength(1)
  })
})

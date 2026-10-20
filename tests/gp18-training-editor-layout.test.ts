import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const training = readFileSync('src/pages/TrainingPage.tsx', 'utf8')
const styles = readFileSync('src/index.css', 'utf8')

describe('GP-18 training editor layout', () => {
  it('groups the session fields into the three responsive editor rows', () => {
    expect(training).toContain('training-editor-core-fields')
    expect(training).toContain('training-editor-primary-fields')
    expect(training).toContain('training-editor-detail-fields')
    expect(training).toContain('className="training-coach-notes"')
  })

  it('uses compact accessible objective chips without changing their selection behavior', () => {
    expect(training).toContain('aria-pressed={selected}')
    expect(training).toContain('training-objective-chip')
    expect(styles).toContain('.training-objective-chip.is-selected')
    expect(styles).toContain('color: var(--primary-foreground)')
  })

  it('keeps inputs and actions usable from phone to desktop', () => {
    expect(styles).toContain('.training-editor-core-fields { grid-template-columns: repeat(2, minmax(0, 1fr)); }')
    expect(styles).toContain('@media (min-width: 1024px)')
    expect(styles).toContain('grid-template-columns: minmax(10rem, 1.1fr) minmax(8rem, .8fr) minmax(8rem, .8fr) minmax(10rem, 1fr)')
    expect(styles).toContain('.training-coach-notes { min-height: 8.5rem !important; resize: vertical;')
    expect(styles).toContain('padding-bottom: calc(5.5rem + env(safe-area-inset-bottom))')
  })
})

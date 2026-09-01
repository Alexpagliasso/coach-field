import type { PlayerRating } from '../types/domain'
import type { PointerEvent } from 'react'

const STAR_VALUES = [1, 2, 3, 4, 5] as const

type PlayerStarRatingProps = {
  value: PlayerRating
  onChange?: (value: PlayerRating) => void
  readonly?: boolean
}

function fillForStar(rating: PlayerRating, star: number) {
  if (rating === null) return 0
  if (rating >= star) return 100
  if (rating >= star - 0.5) return 50
  return 0
}

function formatRating(value: PlayerRating) {
  if (value === null) return 'Non valutato'
  return `${value.toString().replace('.', ',')} / 5`
}

export function PlayerStarRating({ value, onChange, readonly = false }: PlayerStarRatingProps) {
  const setRating = (star: number, event: PointerEvent<HTMLButtonElement>) => {
    if (readonly || !onChange) return
    const rect = event.currentTarget.getBoundingClientRect()
    const half = event.clientX - rect.left <= rect.width / 2
    onChange((half ? star - 0.5 : star) as PlayerRating)
  }

  return (
    <div className={`star-rating ${readonly ? 'readonly' : ''}`}>
      <div className="stars" aria-label={formatRating(value)}>
        {STAR_VALUES.map((star) => (
          <button
            key={star}
            type="button"
            disabled={readonly}
            aria-label={`Valuta ${star - 0.5} o ${star} stelle`}
            onPointerDown={(event) => setRating(star, event)}
          >
            <span className="star-empty">★</span>
            <span className="star-fill" style={{ width: `${fillForStar(value, star)}%` }}>★</span>
          </button>
        ))}
      </div>
      {!readonly && <span className="rating-value">{formatRating(value)}</span>}
    </div>
  )
}

export function CompactStarRating({ value }: { value: PlayerRating }) {
  if (value === null) return <span className="compact-rating">☆ Non valutato</span>
  return (
    <span className="compact-rating" aria-label={formatRating(value)}>
      {STAR_VALUES.map((star) => (
        <span key={star} className="compact-star">
          <span>☆</span>
          <span className="compact-star-fill" style={{ width: `${fillForStar(value, star)}%` }}>★</span>
        </span>
      ))}
    </span>
  )
}

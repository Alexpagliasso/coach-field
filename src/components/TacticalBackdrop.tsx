import type { SVGProps } from 'react'

/** Lightweight editorial field geometry for hero and empty-state surfaces. */
export function TacticalBackdrop(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 640 440" fill="none" aria-hidden="true" focusable="false" {...props}>
    <path d="M34 54H606V386H34zM320 54v332M34 220h572" vectorEffect="non-scaling-stroke" />
    <circle cx="320" cy="220" r="62" vectorEffect="non-scaling-stroke" />
    <path d="M34 126h82v188H34M606 126h-82v188h82M34 168h42v104H34M606 168h-42v104h42" vectorEffect="non-scaling-stroke" />
    <path className="tactical-route" d="M116 314c61-94 118-111 190-65 61 39 117 23 184-69" vectorEffect="non-scaling-stroke" />
    <circle className="tactical-marker tactical-marker-primary" cx="116" cy="314" r="8" />
    <circle className="tactical-marker tactical-marker-coral" cx="490" cy="180" r="8" />
    <circle className="tactical-marker tactical-marker-blue" cx="306" cy="249" r="6" />
  </svg>
}

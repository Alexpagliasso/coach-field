import type { HTMLAttributes, ReactNode } from 'react'

type PanelTone = 'base' | 'accent' | 'quiet'

function classes(...values: Array<string | undefined | false>) { return values.filter(Boolean).join(' ') }

/** Lightweight, data-agnostic building blocks for editorial operational views. */
export function DashboardPanel({ tone = 'base', className, children, ...props }: HTMLAttributes<HTMLElement> & { tone?: PanelTone }) {
  return <article className={classes('dashboard-panel', `dashboard-panel-${tone}`, className)} {...props}>{children}</article>
}

export function DashboardSectionHeading({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: ReactNode }) {
  return <header className="dashboard-section-heading"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h2>{title}</h2></div>{action}</header>
}

export function DashboardStatTile({ label, value, detail }: { label: string; value: number | string; detail: string }) {
  return <article className="dashboard-stat-tile"><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>
}

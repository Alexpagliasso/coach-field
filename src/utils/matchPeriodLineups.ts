import type { CloudMatch, CloudMatchLineupSaveEntry, CloudMatchPeriodLineup } from '../cloud/matchCloudRepository'

export type MatchPeriodDraft = { formation: CloudMatch['initialFormation']; entries: CloudMatchLineupSaveEntry[] }
export type MatchPeriodDrafts = Record<number, MatchPeriodDraft>

export function createPeriodDrafts(periodCount: number, fallback: CloudMatch['initialFormation'], plans: readonly CloudMatchPeriodLineup[]): MatchPeriodDrafts {
  return Object.fromEntries(Array.from({ length: periodCount }, (_, index) => {
    const period = index + 1, plan = plans.find(item => item.periodNumber === period)
    return [period, { formation: plan?.formation ?? fallback, entries: (plan?.entries ?? []).map(entry => ({ playerId: entry.playerId, slotId: entry.slotId, positionX: Number(entry.positionX), positionY: Number(entry.positionY) })) }]
  }))
}

export function assignPeriodPlayer(drafts: MatchPeriodDrafts, period: number, entry: CloudMatchLineupSaveEntry): MatchPeriodDrafts {
  const draft = drafts[period]
  if (!draft) return drafts
  return { ...drafts, [period]: { ...draft, entries: [...draft.entries.filter(item => item.slotId !== entry.slotId && item.playerId !== entry.playerId), entry] } }
}

export function removePeriodPlayer(drafts: MatchPeriodDrafts, period: number, slotId: string): MatchPeriodDrafts {
  const draft = drafts[period]
  return draft ? { ...drafts, [period]: { ...draft, entries: draft.entries.filter(entry => entry.slotId !== slotId) } } : drafts
}

export function changePeriodFormation(drafts: MatchPeriodDrafts, period: number, formation: CloudMatch['initialFormation'], allowedSlots: ReadonlySet<string>): MatchPeriodDrafts {
  const draft = drafts[period]
  return draft ? { ...drafts, [period]: { formation, entries: draft.entries.filter(entry => allowedSlots.has(entry.slotId)) } } : drafts
}

export function copyPeriodDraft(drafts: MatchPeriodDrafts, source: number, target: number): MatchPeriodDrafts {
  const sourceDraft = drafts[source]
  if (!sourceDraft || source === target) return drafts
  return { ...drafts, [target]: { formation: sourceDraft.formation, entries: sourceDraft.entries.map(entry => ({ ...entry })) } }
}

export function plannedPeriodsForPlayer(drafts: MatchPeriodDrafts, playerId: string) {
  return Object.values(drafts).filter(draft => draft.entries.some(entry => entry.playerId === playerId)).length
}

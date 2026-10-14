import type { CloudTrainingSession } from '../cloud/trainingCloudRepository'

/** Query options shared by TodayPage and its behavioural tests. */
export function todaySessionPageOptions(today: string) {
  return { page: 1, pageSize: 50, from: today, to: today }
}

export function firstTodaySession(
  sessions: readonly CloudTrainingSession[],
): CloudTrainingSession | undefined {
  return sessions[0]
}

export function isCurrentTodayRequest(requestId: number, latestRequestId: number) {
  return requestId === latestRequestId
}

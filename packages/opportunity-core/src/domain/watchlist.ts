export type WatchlistAlertType =
  | 'NEW_OPPORTUNITY'
  | 'DEADLINE_APPROACHING'
  | 'OPPORTUNITY_CHANGED'
  | 'PRINCIPAL_CHANGED'
  | 'RELATIONSHIP_CHANGED'
  | 'EVIDENCE_ADDED'
  | 'EVIDENCE_CONFLICT'
  | 'CONFIDENCE_DEGRADED'
  | 'AWARD_HISTORY_CHANGED'
  | 'ELIGIBILITY_CHANGED'
  | 'OPPORTUNITY_CLOSED'

export type AlertPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO'

export type WatchlistEntry = {
  id: string
  userId: string
  opportunityId: string
  principalId?: string
  enabled: boolean
  createdAt: string
}

export type AlertEvent = {
  id: string
  fingerprint: string
  watchlistEntryId: string
  opportunityId: string
  principalId?: string
  type: WatchlistAlertType
  priority: AlertPriority
  previousState?: unknown
  newState?: unknown
  changeReason: string
  supportingEvidenceIds: string[]
  detectedAt: string
  engineVersion: string
}

export type WatchlistSnapshot = {
  opportunityId: string
  principalId?: string
  state: unknown
}

export type WatchlistEvaluation = {
  type: WatchlistAlertType
  priority: AlertPriority
  changeReason: string
  previousState?: unknown
  newState?: unknown
  supportingEvidenceIds: string[]
}

/** Recursively canonicalize JSON-compatible values without changing array order. */
const stable = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`

  const record = value as Record<string, unknown>
  return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${stable(record[key])}`).join(',')}}`
}

export function fingerprintAlert(entry: WatchlistEntry, evaluation: WatchlistEvaluation): string {
  const payload = `${entry.id}|${entry.opportunityId}|${entry.principalId ?? ''}|${evaluation.type}|${stable(evaluation.previousState)}|${stable(evaluation.newState)}|${evaluation.changeReason}`
  let hash = 2166136261
  for (let i = 0; i < payload.length; i += 1) hash = Math.imul(hash ^ payload.charCodeAt(i), 16777619)
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function createAlertEvent(
  entry: WatchlistEntry,
  evaluation: WatchlistEvaluation,
  detectedAt: string,
  engineVersion = '6.74.0',
): AlertEvent {
  return {
    id: `${entry.id}:${fingerprintAlert(entry, evaluation)}`,
    fingerprint: fingerprintAlert(entry, evaluation),
    watchlistEntryId: entry.id,
    opportunityId: entry.opportunityId,
    principalId: entry.principalId,
    type: evaluation.type,
    priority: evaluation.priority,
    previousState: evaluation.previousState,
    newState: evaluation.newState,
    changeReason: evaluation.changeReason,
    supportingEvidenceIds: [...evaluation.supportingEvidenceIds],
    detectedAt,
    engineVersion,
  }
}

export function isDuplicateAlert(existing: Pick<AlertEvent, 'fingerprint'>[], candidate: Pick<AlertEvent, 'fingerprint'>): boolean {
  return existing.some(alert => alert.fingerprint === candidate.fingerprint)
}

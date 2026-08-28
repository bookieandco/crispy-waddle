export type OpportunityLifecycleStage =
  | 'FORECAST'
  | 'PRE_SOLICITATION'
  | 'SOLICITATION'
  | 'Q_AND_A'
  | 'SUBMISSION'
  | 'EVALUATION'
  | 'AWARD'
  | 'ACTIVE'
  | 'EXPIRATION'
  | 'RECOMPETE'
  | 'CLOSED'

export type LifecycleEvent = {
  stage: OpportunityLifecycleStage
  observedAt: string
  effectiveAt?: string
  evidenceId?: string
}

export type LifecycleAssessment = {
  opportunityId: string
  currentStage: OpportunityLifecycleStage
  nextStage?: OpportunityLifecycleStage
  deadlineAt?: string
  daysToDeadline?: number
  urgency: 'OVERDUE' | 'CRITICAL' | 'SOON' | 'NORMAL' | 'NONE'
  evidenceIds: string[]
}

const ORDER: OpportunityLifecycleStage[] = [
  'FORECAST',
  'PRE_SOLICITATION',
  'SOLICITATION',
  'Q_AND_A',
  'SUBMISSION',
  'EVALUATION',
  'AWARD',
  'ACTIVE',
  'EXPIRATION',
  'RECOMPETE',
  'CLOSED',
]

/**
 * Derives lifecycle state from explicit events. It never invents a deadline;
 * deadlineAt must come from supplied evidence or remain undefined.
 */
export function assessOpportunityLifecycle(
  opportunityId: string,
  events: LifecycleEvent[],
  now: Date = new Date(),
  deadlineAt?: string,
): LifecycleAssessment {
  if (events.length === 0) {
    return {
      opportunityId,
      currentStage: 'FORECAST',
      urgency: 'NONE',
      evidenceIds: [],
    }
  }

  const current = events.reduce((latest, event) => {
    return ORDER.indexOf(event.stage) >= ORDER.indexOf(latest.stage) ? event : latest
  }, events[0])

  const currentIndex = ORDER.indexOf(current.stage)
  const nextStage = ORDER[currentIndex + 1]
  const evidenceIds = events.flatMap((event) => (event.evidenceId ? [event.evidenceId] : []))

  let daysToDeadline: number | undefined
  let urgency: LifecycleAssessment['urgency'] = 'NONE'
  if (deadlineAt) {
    const ms = new Date(deadlineAt).getTime() - now.getTime()
    daysToDeadline = Math.ceil(ms / 86_400_000)
    urgency =
      daysToDeadline < 0 ? 'OVERDUE' : daysToDeadline <= 3 ? 'CRITICAL' : daysToDeadline <= 14 ? 'SOON' : 'NORMAL'
  }

  return {
    opportunityId,
    currentStage: current.stage,
    nextStage,
    deadlineAt,
    daysToDeadline,
    urgency,
    evidenceIds,
  }
}

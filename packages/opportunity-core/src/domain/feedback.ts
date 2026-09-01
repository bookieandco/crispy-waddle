export type FeedbackKind =
  | 'OBSERVATION'
  | 'OUTCOME'
  | 'ASSESSMENT'
  | 'LEARNING_SIGNAL'

export type FeedbackEventType =
  | 'OPPORTUNITY_WON'
  | 'OPPORTUNITY_LOST'
  | 'OPPORTUNITY_EXPIRED'
  | 'OPPORTUNITY_DISQUALIFIED'
  | 'PRINCIPAL_CONFIRMED'
  | 'PRINCIPAL_REJECTED'
  | 'RELATIONSHIP_CONFIRMED'
  | 'RELATIONSHIP_DISPUTED'
  | 'SOURCE_CORROBORATED'
  | 'SOURCE_CONFLICTED'
  | 'SOURCE_STALE'
  | 'ALERT_ACKNOWLEDGED'
  | 'ALERT_DISMISSED'
  | 'ALERT_ACTIONED'

export type FeedbackEvent = {
  id: string
  kind: FeedbackKind
  type: FeedbackEventType
  opportunityId?: string
  principalId?: string
  sourceEvidenceIds: string[]
  payload: unknown
  observedAt: string
  recordedAt: string
  schemaVersion: string
}

export type VersionedAssessment = {
  id: string
  subjectId: string
  assessmentType: string
  score: number
  basisEvidenceIds: string[]
  supersedesId?: string
  assessedAt: string
  engineVersion: string
}

let fallbackSequence = 0

function newFeedbackEventId(): string {
  const randomUUID = globalThis.crypto?.randomUUID
  if (randomUUID) return `feedback:${randomUUID()}`
  fallbackSequence += 1
  return `feedback:${Date.now().toString(36)}:${fallbackSequence.toString(36)}`
}

export function createFeedbackEvent(input: Omit<FeedbackEvent, 'id'> & { id?: string }): FeedbackEvent {
  return { ...input, id: input.id ?? newFeedbackEventId() }
}

export function createVersionedAssessment(input: Omit<VersionedAssessment, 'id'> & { id?: string }): VersionedAssessment {
  const id = input.id ?? `${input.subjectId}:${input.assessmentType}:${input.assessedAt}:${input.engineVersion}`
  return { ...input, id }
}

export function isLearningSignal(event: Pick<FeedbackEvent, 'kind'>): boolean {
  return event.kind === 'LEARNING_SIGNAL'
}

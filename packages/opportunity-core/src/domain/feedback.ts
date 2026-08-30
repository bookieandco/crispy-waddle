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

export function createFeedbackEvent(input: Omit<FeedbackEvent, 'id'> & { id?: string }): FeedbackEvent {
  const id = input.id ?? `${input.type}:${input.opportunityId ?? ''}:${input.principalId ?? ''}:${input.observedAt}`
  return { ...input, id }
}

export function createVersionedAssessment(input: Omit<VersionedAssessment, 'id'> & { id?: string }): VersionedAssessment {
  const id = input.id ?? `${input.subjectId}:${input.assessmentType}:${input.assessedAt}:${input.engineVersion}`
  return { ...input, id }
}

export function isLearningSignal(event: Pick<FeedbackEvent, 'kind'>): boolean {
  return event.kind === 'LEARNING_SIGNAL'
}

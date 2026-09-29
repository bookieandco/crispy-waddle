import type { DomainEvent, RuntimeEventContext } from './index.js'

export const TRANSCRIPT_FOLD_EVENT_TYPES = {
  OFFER_CANVAS_PERSISTED: 'commercial.offer_canvas.persisted',
  VALIDATION_TEST_PERSISTED: 'commercial.validation_test.persisted',
  MARKET_LEARNING_OBSERVED: 'commercial.market_learning.observed',
  PROOF_SPRINT_PERSISTED: 'commercial.proof_sprint.persisted',
  RECURRING_OFFER_ASSESSED: 'commercial.recurring_offer.assessed',
  PROSPECT_ICP_PERSISTED: 'prospect.icp.persisted',
  PROSPECT_RECORD_PERSISTED: 'prospect.record.persisted',
  SOCIAL_CANARY_CREATED: 'social.publish_canary.created',
  SOCIAL_CANARY_RECEIPT_CAPTURED: 'social.publish_canary.receipt_captured',
} as const

export type TranscriptFoldEventType =
  typeof TRANSCRIPT_FOLD_EVENT_TYPES[keyof typeof TRANSCRIPT_FOLD_EVENT_TYPES]

export type TranscriptFoldEventPayloadMap = {
  'commercial.offer_canvas.persisted': {
    recordId: string
    opportunityId: string
    evidenceRefs: readonly string[]
  }
  'commercial.validation_test.persisted': {
    recordId: string
    opportunityId: string
    expectedCommitment: string
    evidenceRefs: readonly string[]
  }
  'commercial.market_learning.observed': {
    recordId: string
    opportunityId: string
    commitmentLevel: string
    evidenceRefs: readonly string[]
  }
  'commercial.proof_sprint.persisted': {
    recordId: string
    opportunityId: string
    validationTestIds: readonly string[]
  }
  'commercial.recurring_offer.assessed': {
    recordId: string
    opportunityId: string
    supported: boolean
    evidenceRefs: readonly string[]
  }
  'prospect.icp.persisted': {
    icpId: string
    evidenceRefs: readonly string[]
  }
  'prospect.record.persisted': {
    prospectId: string
    icpId: string
    contactQuality: string
    suppressionState: string
    evidenceRefs: readonly string[]
  }
  'social.publish_canary.created': {
    planId: string
    assetId: string
    canaryPlatform: string
    expansionPlatforms: readonly string[]
  }
  'social.publish_canary.receipt_captured': {
    planId: string
    receiptId: string
    assetId: string
    platform: string
    state: string
    evidenceRefs: readonly string[]
  }
}

export type TranscriptFoldEvent<TType extends TranscriptFoldEventType = TranscriptFoldEventType> =
  DomainEvent<TranscriptFoldEventPayloadMap[TType]> & {
    readonly type: TType
    readonly context: RuntimeEventContext
  }

export function createTranscriptFoldEvent<TType extends TranscriptFoldEventType>(input: {
  type: TType
  entityId: string
  occurredAt: string
  payload: TranscriptFoldEventPayloadMap[TType]
  runtime: {
    workSessionId: string
    taskId?: string
    correlationId: string
    causationId?: string
    actorId: string
  }
}): TranscriptFoldEvent<TType> {
  requireText(input.entityId, 'TRANSCRIPT_EVENT_ENTITY_ID_REQUIRED')
  requireTimestamp(input.occurredAt)
  requireText(input.runtime.workSessionId, 'TRANSCRIPT_EVENT_WORK_SESSION_REQUIRED')
  requireText(input.runtime.correlationId, 'TRANSCRIPT_EVENT_CORRELATION_REQUIRED')
  requireText(input.runtime.actorId, 'TRANSCRIPT_EVENT_ACTOR_REQUIRED')

  const domain = input.type.startsWith('social.') ? 'social' : 'opportunity'
  const capability = input.type.startsWith('social.')
    ? 'social.publish-canary'
    : input.type.startsWith('prospect.')
      ? 'opportunity.prospect-intelligence'
      : 'opportunity.commercial-learning'

  const idempotencyKey = `transcript-fold:${input.type}:${input.entityId}`
  const id = `${input.runtime.workSessionId}:${idempotencyKey}`

  return Object.freeze({
    id,
    type: input.type,
    occurredAt: input.occurredAt,
    payload: freezePayload(input.payload),
    context: Object.freeze({
      workSessionId: input.runtime.workSessionId.trim(),
      taskId: input.runtime.taskId?.trim() || undefined,
      correlationId: input.runtime.correlationId.trim(),
      causationId: input.runtime.causationId?.trim() || undefined,
      actorId: input.runtime.actorId.trim(),
      domain,
      capability,
      // Transcript-derived evidence events never carry action authority.
      authorityRef: undefined,
      idempotencyKey,
    }),
  })
}

function freezePayload<T>(payload: T): T {
  if (!payload || typeof payload !== 'object') return payload
  const value = payload as Record<string, unknown>
  const copy: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value)) {
    copy[key] = Array.isArray(item) ? Object.freeze([...item]) : item
  }
  return Object.freeze(copy) as T
}

function requireText(value: string, code: string): void {
  if (!value?.trim()) throw new Error(code)
}

function requireTimestamp(value: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new Error('TRANSCRIPT_EVENT_TIMESTAMP_INVALID')
}

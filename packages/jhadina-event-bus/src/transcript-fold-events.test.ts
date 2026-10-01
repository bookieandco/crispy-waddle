import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createTranscriptFoldEvent,
  TRANSCRIPT_FOLD_EVENT_TYPES,
} from './transcript-fold-events.js'

test('commercial events are deterministic, traceable, and authority-free', () => {
  const input = {
    type: TRANSCRIPT_FOLD_EVENT_TYPES.MARKET_LEARNING_OBSERVED,
    entityId: 'learning:1',
    occurredAt: '2026-09-28T19:00:00.000Z',
    payload: {
      recordId: 'learning:1',
      opportunityId: 'opp:1',
      commitmentLevel: 'paid',
      evidenceRefs: ['receipt:1'],
    },
    runtime: {
      workSessionId: 'ws:1',
      correlationId: 'corr:1',
      actorId: 'user:1',
    },
  } as const

  const first = createTranscriptFoldEvent(input)
  const second = createTranscriptFoldEvent(input)

  assert.equal(first.id, second.id)
  assert.equal(first.context.idempotencyKey, second.context.idempotencyKey)
  assert.equal(first.context.domain, 'opportunity')
  assert.equal(first.context.capability, 'opportunity.commercial-learning')
  assert.equal(first.context.authorityRef, undefined)
})

test('prospect events expose no contact fields in their contract', () => {
  const event = createTranscriptFoldEvent({
    type: TRANSCRIPT_FOLD_EVENT_TYPES.PROSPECT_RECORD_PERSISTED,
    entityId: 'prospect:1',
    occurredAt: '2026-09-28T19:00:00.000Z',
    payload: {
      prospectId: 'prospect:1',
      icpId: 'icp:1',
      contactQuality: 'public_professional',
      suppressionState: 'clear',
      evidenceRefs: ['evidence:1'],
    },
    runtime: {
      workSessionId: 'ws:1',
      taskId: 'task:1',
      correlationId: 'corr:1',
      actorId: 'user:1',
    },
  })

  assert.equal(event.context.domain, 'opportunity')
  assert.equal('businessContact' in event.payload, false)
  assert.equal('contactName' in event.payload, false)
})

test('social canary events bind to social capability without authority', () => {
  const event = createTranscriptFoldEvent({
    type: TRANSCRIPT_FOLD_EVENT_TYPES.SOCIAL_CANARY_RECEIPT_CAPTURED,
    entityId: 'receipt:1',
    occurredAt: '2026-09-28T19:00:00.000Z',
    payload: {
      planId: 'plan:1',
      receiptId: 'receipt:1',
      assetId: 'asset:1',
      platform: 'instagram',
      state: 'published',
      evidenceRefs: ['social-outbox:1'],
    },
    runtime: {
      workSessionId: 'ws:1',
      correlationId: 'corr:1',
      causationId: 'evt:previous',
      actorId: 'user:1',
    },
  })

  assert.equal(event.context.domain, 'social')
  assert.equal(event.context.capability, 'social.publish-canary')
  assert.equal(event.context.authorityRef, undefined)
})

test('event creation rejects missing runtime traceability', () => {
  assert.throws(() => createTranscriptFoldEvent({
    type: TRANSCRIPT_FOLD_EVENT_TYPES.PROSPECT_ICP_PERSISTED,
    entityId: 'icp:1',
    occurredAt: '2026-09-28T19:00:00.000Z',
    payload: { icpId: 'icp:1', evidenceRefs: ['e:1'] },
    runtime: {
      workSessionId: '',
      correlationId: 'corr:1',
      actorId: 'user:1',
    },
  }), /WORK_SESSION_REQUIRED/)
})

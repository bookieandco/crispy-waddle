import assert from 'node:assert/strict'
import type { Opportunity } from './opportunity.js'
import { buildSideHustleProfile } from './side-hustles.js'
import {
  applySideHustleExperimentEvaluation,
  completeSideHustleExperiment,
  createSideHustleExperiment,
  evaluateSideHustleExperiment,
  recordSideHustleExperimentObservation,
  startSideHustleExperiment,
  type SideHustleExperimentObservation,
} from './side-hustle-experiment.js'

const now = '2026-09-22T15:00:00.000Z'

function opportunity(role: 'standalone' | 'add_on' | 'capability' = 'standalone'): Opportunity {
  return {
    id: 'opportunity:side-hustle-1',
    title: 'AI discovery audit',
    family: 'business',
    type: 'commercial',
    sourceUrl: 'https://example.test/opportunity',
    sourceName: 'Fixture',
    claims: [{
      id: 'claim:1',
      field: 'discovery',
      value: 'fixture',
      sourceId: 'source:1',
      sourceType: 'user',
      confidence: 0.8,
      verified: false,
    }],
    evidence: [{
      id: 'evidence:1',
      sourceId: 'source:1',
      sourceUrl: 'https://example.test/opportunity',
      sourceName: 'Fixture',
      sourceType: 'user',
      capturedAt: now,
      confidence: 0.8,
    }],
    verificationStatus: 'unverified',
    sourceConfidence: 0.8,
    riskFlags: [],
    metadata: {
      sideHustleProfile: buildSideHustleProfile({
        family: role === 'capability' ? 'trading_investing_intelligence' : 'ai_discovery_seo',
        role,
        automationMaturity: 'ai_assisted',
      }),
    },
    status: 'discovered',
    createdAt: now,
    updatedAt: now,
  }
}

function experimentFixture(role: 'standalone' | 'add_on' = 'standalone') {
  return createSideHustleExperiment({
    opportunity: opportunity(role),
    hypothesis: 'Local service businesses will pay for an AI discovery audit.',
    targetCustomer: 'Local service business owner',
    channel: 'Warm referral and permissioned outbound',
    offer: '$250 discovery audit',
    maxSpend: 100,
    currency: 'usd',
    maxHours: 8,
    maxDurationDays: 14,
    minimumObservations: 2,
    successCriteria: [
      { id: 'paid_customer', metric: 'paid_customers', operator: 'gte', threshold: 1, aggregation: 'sum', unit: 'customers' },
      { id: 'reply_rate', metric: 'reply_rate', operator: 'gte', threshold: 0.1, aggregation: 'average', unit: 'ratio' },
    ],
    killCriteria: [
      { id: 'refund_rate', metric: 'refund_rate', operator: 'gte', threshold: 0.5, aggregation: 'max', unit: 'ratio' },
    ],
    evidenceRefs: ['research:market-demand'],
    createdAt: now,
  })
}

function observation(experimentId: string, id: string, metrics: Record<string, number>, spend = 20, hours = 1): SideHustleExperimentObservation {
  return {
    id,
    experimentId,
    observedAt: '2026-09-23T15:00:00.000Z',
    metrics,
    spend,
    hours,
    evidenceRefs: [`evidence:${id}`],
  }
}

{
  const experiment = experimentFixture()
  assert.equal(experiment.requiresApproval, true)
  assert.equal(experiment.status, 'planned')
  assert.equal(experiment.currency, 'USD')
  assert.equal(experiment.profile.family, 'ai_discovery_seo')
}

{
  assert.throws(
    () => createSideHustleExperiment({
      opportunity: opportunity('capability'),
      hypothesis: 'Capability-only profile',
      targetCustomer: 'N/A',
      channel: 'N/A',
      offer: 'N/A',
      maxSpend: 0,
      currency: 'USD',
      maxHours: 1,
      maxDurationDays: 1,
      minimumObservations: 1,
      successCriteria: [{ id: 'x', metric: 'x', operator: 'gte', threshold: 1, aggregation: 'sum', unit: 'count' }],
      evidenceRefs: ['evidence:1'],
      createdAt: now,
    }),
    /cannot be promoted as standalone businesses/,
  )
}

{
  let experiment = experimentFixture()
  experiment = startSideHustleExperiment(experiment, '2026-09-22T16:00:00.000Z')

  const observations = [
    recordSideHustleExperimentObservation({
      experiment,
      observation: observation(experiment.id, 'obs:1', { paid_customers: 1, reply_rate: 0.12, refund_rate: 0 }),
    }),
    recordSideHustleExperimentObservation({
      experiment,
      observation: observation(experiment.id, 'obs:2', { paid_customers: 0, reply_rate: 0.15, refund_rate: 0 }),
    }),
  ]

  const evaluation = evaluateSideHustleExperiment({
    experiment,
    observations,
    evaluatedAt: '2026-09-24T15:00:00.000Z',
  })

  assert.equal(evaluation.decision, 'promote')
  assert.deepEqual(evaluation.successCriteriaMissed, [])
  assert.ok(evaluation.evidenceRefs.includes('research:market-demand'))

  const before = opportunity()
  const after = applySideHustleExperimentEvaluation(before, evaluation)
  assert.equal(after.status, 'discovered')
  assert.equal(after.metadata?.sideHustleValidationDecision, 'promote')
  assert.deepEqual(after.metadata?.sideHustleValidationEvidenceRefs, evaluation.evidenceRefs)

  experiment = completeSideHustleExperiment(experiment, '2026-09-24T15:00:00.000Z')
  assert.equal(experiment.status, 'completed')
}

{
  const experiment = startSideHustleExperiment(experimentFixture(), '2026-09-22T16:00:00.000Z')
  const evaluation = evaluateSideHustleExperiment({
    experiment,
    observations: [
      observation(experiment.id, 'obs:1', { paid_customers: 0, reply_rate: 0.02, refund_rate: 0 }),
    ],
    evaluatedAt: '2026-09-23T15:00:00.000Z',
  })
  assert.equal(evaluation.decision, 'insufficient_evidence')
}

{
  const experiment = startSideHustleExperiment(experimentFixture(), '2026-09-22T16:00:00.000Z')
  const evaluation = evaluateSideHustleExperiment({
    experiment,
    observations: [
      observation(experiment.id, 'obs:1', { paid_customers: 1, reply_rate: 0.2, refund_rate: 0.7 }),
      observation(experiment.id, 'obs:2', { paid_customers: 1, reply_rate: 0.2, refund_rate: 0 }),
    ],
    evaluatedAt: '2026-09-23T15:00:00.000Z',
  })
  assert.equal(evaluation.decision, 'kill')
  assert.deepEqual(evaluation.killCriteriaMet, ['refund_rate'])
}

{
  const experiment = startSideHustleExperiment(experimentFixture(), '2026-09-22T16:00:00.000Z')
  const evaluation = evaluateSideHustleExperiment({
    experiment,
    observations: [
      observation(experiment.id, 'obs:1', { paid_customers: 1, reply_rate: 0.2, refund_rate: 0 }, 70, 5),
      observation(experiment.id, 'obs:2', { paid_customers: 1, reply_rate: 0.2, refund_rate: 0 }, 70, 5),
    ],
    evaluatedAt: '2026-09-23T15:00:00.000Z',
  })
  assert.equal(evaluation.decision, 'kill')
  assert.ok(evaluation.reasons.some((reason) => reason.includes('spend cap exceeded')))
  assert.ok(evaluation.reasons.some((reason) => reason.includes('hour cap exceeded')))
}

{
  const experiment = startSideHustleExperiment(experimentFixture('add_on'), '2026-09-22T16:00:00.000Z')
  const evaluation = evaluateSideHustleExperiment({
    experiment,
    observations: [
      observation(experiment.id, 'obs:1', { paid_customers: 0, reply_rate: 0.03, refund_rate: 0 }),
      observation(experiment.id, 'obs:2', { paid_customers: 0, reply_rate: 0.04, refund_rate: 0 }),
    ],
    evaluatedAt: '2026-09-24T15:00:00.000Z',
  })
  assert.equal(evaluation.decision, 'iterate')
  assert.ok(evaluation.successCriteriaMissed.includes('paid_customer'))
}

console.log('side hustle validation experiment tests passed')


{
  const experiment = startSideHustleExperiment(experimentFixture(), '2026-09-22T16:00:00.000Z')
  assert.throws(
    () => evaluateSideHustleExperiment({
      experiment,
      observations: [
        observation(experiment.id, 'obs:future', { paid_customers: 1, reply_rate: 0.2, refund_rate: 0 }),
      ].map((item) => ({ ...item, observedAt: '2026-09-25T15:00:00.000Z' })),
      evaluatedAt: '2026-09-24T15:00:00.000Z',
    }),
    /cannot include future observations/,
  )
}

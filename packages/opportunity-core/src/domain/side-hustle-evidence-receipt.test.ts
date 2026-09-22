import assert from 'node:assert/strict'
import type { Opportunity } from './opportunity.js'
import { buildSideHustleProfile } from './side-hustles.js'
import {
  createSideHustleExperiment,
  startSideHustleExperiment,
} from './side-hustle-experiment.js'
import {
  compileSideHustleObservationFromReceipt,
  trackedSideHustleExperimentMetrics,
  validateSideHustleEvidenceReceipt,
} from './side-hustle-evidence-receipt.js'

const createdAt = '2026-09-22T15:00:00.000Z'
const startedAt = '2026-09-22T16:00:00.000Z'

function opportunity(): Opportunity {
  return {
    id: 'opportunity:evidence-bridge',
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
      capturedAt: createdAt,
      confidence: 0.8,
    }],
    verificationStatus: 'unverified',
    sourceConfidence: 0.8,
    riskFlags: [],
    metadata: {
      sideHustleProfile: buildSideHustleProfile({
        family: 'ai_discovery_seo',
        role: 'standalone',
        automationMaturity: 'ai_assisted',
      }),
    },
    status: 'discovered',
    createdAt,
    updatedAt: createdAt,
  }
}

const planned = createSideHustleExperiment({
  opportunity: opportunity(),
  hypothesis: 'A buyer will pay for an AI discovery audit.',
  targetCustomer: 'Local service businesses',
  channel: 'Permissioned outreach',
  offer: '$250 audit',
  maxSpend: 100,
  currency: 'USD',
  maxHours: 8,
  maxDurationDays: 14,
  minimumObservations: 2,
  successCriteria: [
    { id: 'paid', metric: 'paid_commitments', operator: 'gte', threshold: 1, aggregation: 'sum', unit: 'customers' },
    { id: 'qualified', metric: 'qualified_conversations', operator: 'gte', threshold: 3, aggregation: 'sum', unit: 'conversations' },
  ],
  killCriteria: [
    { id: 'blockers', metric: 'serious_fit_blockers', operator: 'gte', threshold: 3, aggregation: 'sum', unit: 'blockers' },
  ],
  evidenceRefs: ['research:1'],
  createdAt,
})
const experiment = startSideHustleExperiment(planned, startedAt)

{
  assert.deepEqual(
    trackedSideHustleExperimentMetrics(experiment),
    ['paid_commitments', 'qualified_conversations', 'serious_fit_blockers'],
  )
}

{
  const receipt = validateSideHustleEvidenceReceipt({
    id: 'growth-receipt:1',
    opportunityId: experiment.opportunityId,
    experimentId: experiment.id,
    sourceOwner: 'growth',
    sourceRecordType: 'allocation_measurement',
    sourceRecordId: 'growth-measurement:1',
    observedAt: '2026-09-23T16:00:00.000Z',
    metrics: {
      paid_commitments: 1,
      qualified_conversations: 2,
      serious_fit_blockers: 0,
      irrelevant_growth_metric: 19,
    },
    spend: 25,
    hours: 1.5,
    evidenceRefs: ['growth:event:1'],
    actionRef: 'action:growth:1',
    executionRef: 'execution:growth:1',
  })

  const compiled = compileSideHustleObservationFromReceipt({ experiment, receipt })
  assert.equal(compiled.observation.id, 'side-hustle-observation:growth:allocation_measurement:growth-measurement:1')
  assert.deepEqual(compiled.observation.metrics, {
    paid_commitments: 1,
    qualified_conversations: 2,
    serious_fit_blockers: 0,
  })
  assert.deepEqual(compiled.ignoredMetrics, ['irrelevant_growth_metric'])
  assert.ok(compiled.observation.evidenceRefs.includes('growth:event:1'))
  assert.ok(compiled.observation.evidenceRefs.includes('action:growth:1'))
  assert.ok(compiled.observation.evidenceRefs.includes('execution:growth:1'))
  assert.ok(compiled.observation.evidenceRefs.includes('growth:allocation_measurement:growth-measurement:1'))
}

{
  assert.throws(
    () => compileSideHustleObservationFromReceipt({
      experiment,
      receipt: {
        id: 'growth-receipt:missing',
        opportunityId: experiment.opportunityId,
        sourceOwner: 'growth',
        sourceRecordType: 'allocation_measurement',
        sourceRecordId: 'growth-measurement:missing',
        observedAt: '2026-09-23T16:00:00.000Z',
        metrics: {
          paid_commitments: 1,
          qualified_conversations: 2,
        },
        spend: 25,
        hours: 1,
        evidenceRefs: ['growth:event:missing'],
      },
    }),
    /missing tracked metrics: serious_fit_blockers/,
  )
}

{
  assert.throws(
    () => compileSideHustleObservationFromReceipt({
      experiment,
      receipt: {
        id: 'growth-receipt:wrong-opportunity',
        opportunityId: 'opportunity:other',
        sourceOwner: 'growth',
        sourceRecordType: 'allocation_measurement',
        sourceRecordId: 'growth-measurement:wrong',
        observedAt: '2026-09-23T16:00:00.000Z',
        metrics: {
          paid_commitments: 1,
          qualified_conversations: 2,
          serious_fit_blockers: 0,
        },
        spend: 25,
        hours: 1,
        evidenceRefs: ['growth:event:wrong'],
      },
    }),
    /opportunity does not match/,
  )
}

{
  assert.throws(
    () => compileSideHustleObservationFromReceipt({
      experiment,
      receipt: {
        id: 'growth-receipt:futureless',
        opportunityId: experiment.opportunityId,
        sourceOwner: 'growth',
        sourceRecordType: 'allocation_measurement',
        sourceRecordId: 'growth-measurement:early',
        observedAt: '2026-09-22T15:30:00.000Z',
        metrics: {
          paid_commitments: 1,
          qualified_conversations: 2,
          serious_fit_blockers: 0,
        },
        spend: 25,
        hours: 1,
        evidenceRefs: ['growth:event:early'],
      },
    }),
    /cannot predate experiment start/,
  )
}

{
  assert.throws(
    () => validateSideHustleEvidenceReceipt({
      id: 'bad',
      opportunityId: experiment.opportunityId,
      sourceOwner: 'growth',
      sourceRecordType: 'allocation_measurement',
      sourceRecordId: 'bad',
      observedAt: '2026-09-23T16:00:00.000Z',
      metrics: { paid_commitments: Number.NaN },
      spend: 0,
      hours: 0,
      evidenceRefs: ['growth:event:bad'],
    }),
    /must be finite/,
  )
}

console.log('side hustle evidence receipt tests passed')

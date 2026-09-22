import assert from 'node:assert/strict'
import type { Opportunity } from './opportunity.js'
import { calculateOpportunityOutcome, type OpportunityOutcome } from './outcome.js'
import {
  completeSideHustleExperiment,
  createSideHustleExperiment,
  startSideHustleExperiment,
  type SideHustleExperimentEvaluation,
} from './side-hustle-experiment.js'
import {
  applySideHustleMaturityPromotion,
  assessSideHustleMaturityPromotion,
  nextSideHustleAutomationMaturity,
} from './side-hustle-maturity.js'
import {
  buildSideHustleProfile,
  type SideHustleAutomationMaturity,
} from './side-hustles.js'

const assessedAt = '2026-09-22T20:00:00.000Z'

function opportunity(
  maturity: SideHustleAutomationMaturity = 'unvalidated',
  role: 'standalone' | 'add_on' | 'capability' = 'standalone',
): Opportunity {
  return {
    id: 'opportunity:maturity-1',
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
      capturedAt: '2026-09-20T00:00:00.000Z',
      confidence: 0.8,
    }],
    verificationStatus: 'unverified',
    sourceConfidence: 0.8,
    riskFlags: [],
    metadata: {
      sideHustleProfile: buildSideHustleProfile({
        family: role === 'capability' ? 'trading_investing_intelligence' : 'ai_discovery_seo',
        role,
        automationMaturity: maturity,
      }),
    },
    status: 'won',
    createdAt: '2026-09-20T00:00:00.000Z',
    updatedAt: '2026-09-20T00:00:00.000Z',
  }
}

function completedValidationExperiment() {
  const planned = createSideHustleExperiment({
    opportunity: opportunity('unvalidated'),
    hypothesis: 'A buyer will pay for an AI discovery audit.',
    targetCustomer: 'Local service businesses',
    channel: 'Permissioned outreach',
    offer: '$250 audit',
    maxSpend: 100,
    currency: 'USD',
    maxHours: 8,
    maxDurationDays: 14,
    minimumObservations: 1,
    successCriteria: [
      { id: 'paid', metric: 'paid_commitments', operator: 'gte', threshold: 1, aggregation: 'sum', unit: 'customers' },
    ],
    evidenceRefs: ['experiment:plan:1'],
    createdAt: '2026-09-20T01:00:00.000Z',
  })
  const running = startSideHustleExperiment(planned, '2026-09-20T02:00:00.000Z')
  return completeSideHustleExperiment(running, '2026-09-20T23:00:00.000Z')
}

function promotedValidation(
  experimentId = completedValidationExperiment().id,
): SideHustleExperimentEvaluation {
  return {
    experimentId,
    opportunityId: 'opportunity:maturity-1',
    decision: 'promote',
    observationCount: 3,
    totalSpend: 50,
    totalHours: 4,
    successCriteriaMet: ['paid'],
    successCriteriaMissed: [],
    killCriteriaMet: [],
    evidenceRefs: ['experiment:evidence:1'],
    reasons: ['all success criteria met within experiment bounds'],
    evaluatedAt: '2026-09-21T00:00:00.000Z',
  }
}

function wonOutcome(id: string): OpportunityOutcome {
  return calculateOpportunityOutcome({
    id,
    opportunityId: 'opportunity:maturity-1',
    result: 'won',
    currency: 'USD',
    grossRevenue: 250,
    refunds: 0,
    directCosts: 50,
    fees: 5,
    hours: 2,
    sourceOwner: 'commerce',
    evidenceRefs: [`outcome:evidence:${id}`],
    transactionRefs: [`transaction:${id}`],
    actionRef: `action:${id}`,
    executionRef: `execution:${id}`,
    observedAt: '2026-09-21T12:00:00.000Z',
  })
}

function evidence(outcomeCount: number) {
  return {
    validationRecords: [{
      experiment: completedValidationExperiment(),
      evaluation: promotedValidation(),
    }],
    outcomes: Array.from({ length: outcomeCount }, (_, index) => wonOutcome(`outcome:${index + 1}`)),
    workflowEvidenceRefs: ['workflow:1'],
    aiAssistEvidenceRefs: ['ai-assist:1'],
    automationRunEvidenceRefs: ['automation:1', 'automation:2', 'automation:3', 'automation:4', 'automation:5'],
    exceptionHandlingEvidenceRefs: ['exception:1', 'exception:2'],
    monitoringEvidenceRefs: ['monitoring:1'],
    recoveryEvidenceRefs: ['recovery:1'],
    humanOverrideEvidenceRefs: ['override:1'],
    auditEvidenceRefs: ['audit:1', 'audit:2'],
  }
}

{
  assert.equal(nextSideHustleAutomationMaturity('unvalidated'), 'human_delivered')
  assert.equal(nextSideHustleAutomationMaturity('human_delivered'), 'ai_assisted')
  assert.equal(nextSideHustleAutomationMaturity('exception_managed'), 'autonomous_cell')
  assert.equal(nextSideHustleAutomationMaturity('autonomous_cell'), undefined)
}

{
  const assessment = assessSideHustleMaturityPromotion({
    opportunity: opportunity('unvalidated'),
    target: 'human_delivered',
    evidence: evidence(1),
    assessedAt,
  })
  assert.equal(assessment.decision, 'eligible')
  assert.equal(assessment.successfulDeliveries, 1)
  assert.equal(assessment.validationPromotions, 1)
  assert.equal(assessment.authorizationEffect, 'NONE')
  assert.equal(assessment.requiresHumanApproval, true)

  const applied = applySideHustleMaturityPromotion({
    opportunity: opportunity('unvalidated'),
    assessment,
    approvalRef: 'approval:maturity:1',
    appliedAt: '2026-09-22T20:01:00.000Z',
  })
  const profile = applied.opportunity.metadata?.sideHustleProfile as { automationMaturity: string }
  assert.equal(profile.automationMaturity, 'human_delivered')
  assert.equal(applied.receipt.authorizationEffect, 'NONE')
  assert.equal(applied.receipt.approvalRef, 'approval:maturity:1')
}

{
  const assessment = assessSideHustleMaturityPromotion({
    opportunity: opportunity('human_delivered'),
    target: 'ai_assisted',
    evidence: evidence(2),
    assessedAt,
  })
  assert.equal(assessment.decision, 'eligible')
}

{
  const assessment = assessSideHustleMaturityPromotion({
    opportunity: opportunity('ai_assisted'),
    target: 'workflow_automated',
    evidence: evidence(3),
    assessedAt,
  })
  assert.equal(assessment.decision, 'eligible')
}

{
  const assessment = assessSideHustleMaturityPromotion({
    opportunity: opportunity('workflow_automated'),
    target: 'exception_managed',
    evidence: evidence(3),
    assessedAt,
  })
  assert.equal(assessment.decision, 'eligible')
}

{
  const assessment = assessSideHustleMaturityPromotion({
    opportunity: opportunity('exception_managed'),
    target: 'autonomous_cell',
    evidence: evidence(5),
    assessedAt,
  })
  assert.equal(assessment.decision, 'eligible')
  assert.ok(assessment.evidenceRefs.includes('recovery:1'))
  assert.ok(assessment.evidenceRefs.includes('override:1'))
  assert.ok(assessment.evidenceRefs.includes('audit:2'))
}

{
  const assessment = assessSideHustleMaturityPromotion({
    opportunity: opportunity('human_delivered'),
    target: 'workflow_automated',
    evidence: evidence(5),
    assessedAt,
  })
  assert.equal(assessment.decision, 'blocked')
  assert.ok(assessment.blockers.some((blocker) => blocker.includes('cannot be skipped')))
}

{
  const missing = evidence(3)
  missing.automationRunEvidenceRefs = ['automation:1']
  missing.humanOverrideEvidenceRefs = []
  const assessment = assessSideHustleMaturityPromotion({
    opportunity: opportunity('ai_assisted'),
    target: 'workflow_automated',
    evidence: missing,
    assessedAt,
  })
  assert.equal(assessment.decision, 'blocked')
  assert.ok(assessment.blockers.some((blocker) => blocker.includes('successful governed automation runs')))
  assert.ok(assessment.blockers.some((blocker) => blocker.includes('human override')))
  assert.throws(
    () => applySideHustleMaturityPromotion({
      opportunity: opportunity('ai_assisted'),
      assessment,
      approvalRef: 'approval:blocked',
      appliedAt: '2026-09-22T20:01:00.000Z',
    }),
    /Blocked maturity assessment/,
  )
}

{
  const noValidation = evidence(1)
  noValidation.validationRecords = []
  const assessment = assessSideHustleMaturityPromotion({
    opportunity: opportunity('unvalidated'),
    target: 'human_delivered',
    evidence: noValidation,
    assessedAt,
  })
  assert.equal(assessment.decision, 'blocked')
  assert.ok(assessment.blockers.some((blocker) => blocker.includes('promoted bounded validation')))
}

{
  assert.throws(
    () => assessSideHustleMaturityPromotion({
      opportunity: opportunity('unvalidated', 'capability'),
      target: 'human_delivered',
      evidence: evidence(5),
      assessedAt,
    }),
    /Capability-only profiles/,
  )
}

{
  const future = evidence(1)
  future.validationRecords = [{
    experiment: completedValidationExperiment(),
    evaluation: {
      ...promotedValidation(),
      evaluatedAt: '2026-09-23T00:00:00.000Z',
    },
  }]
  assert.throws(
    () => assessSideHustleMaturityPromotion({
      opportunity: opportunity('unvalidated'),
      target: 'human_delivered',
      evidence: future,
      assessedAt,
    }),
    /future validation evidence/,
  )
}

{
  const runningEvidence = evidence(1)
  runningEvidence.validationRecords = [{
    experiment: startSideHustleExperiment(
      createSideHustleExperiment({
        opportunity: opportunity('unvalidated'),
        hypothesis: 'Still running',
        targetCustomer: 'Buyer',
        channel: 'Permissioned',
        offer: 'Offer',
        maxSpend: 10,
        currency: 'USD',
        maxHours: 2,
        maxDurationDays: 7,
        minimumObservations: 1,
        successCriteria: [{ id: 'paid', metric: 'paid', operator: 'gte', threshold: 1, aggregation: 'sum', unit: 'customers' }],
        evidenceRefs: ['plan:running'],
        createdAt: '2026-09-20T01:00:00.000Z',
      }),
      '2026-09-20T02:00:00.000Z',
    ),
    evaluation: promotedValidation(),
  }]
  assert.throws(
    () => assessSideHustleMaturityPromotion({
      opportunity: opportunity('unvalidated'),
      target: 'human_delivered',
      evidence: runningEvidence,
      assessedAt,
    }),
    /requires completed validation experiments/,
  )
}

{
  const assessment = assessSideHustleMaturityPromotion({
    opportunity: opportunity('unvalidated'),
    target: 'human_delivered',
    evidence: evidence(1),
    assessedAt,
  })
  assert.throws(
    () => applySideHustleMaturityPromotion({
      opportunity: opportunity('unvalidated'),
      assessment,
      approvalRef: '',
      appliedAt: '2026-09-22T20:01:00.000Z',
    }),
    /approvalRef is required/,
  )
}

console.log('side hustle maturity gate tests passed')

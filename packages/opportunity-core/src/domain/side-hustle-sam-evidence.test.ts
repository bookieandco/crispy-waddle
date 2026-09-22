import assert from 'node:assert/strict'
import type { SamPursuitSnapshot } from './sam-pursuit-persistence.js'
import { buildSamSideHustleEvidenceReceipt } from './side-hustle-sam-evidence.js'

function snapshot(overrides: Partial<SamPursuitSnapshot> = {}): SamPursuitSnapshot {
  return {
    schemaVersion: 1,
    opportunityId: 'opportunity:sam-1',
    revision: 4,
    savedAt: '2026-09-22T18:00:00.000Z',
    requirements: {
      opportunityId: 'opportunity:sam-1',
      generatedAt: '2026-09-22T17:00:00.000Z',
      unresolved: [],
      requirements: [{
        id: 'requirement:1',
        opportunityId: 'opportunity:sam-1',
        kind: 'capability',
        label: 'Provide food service',
        severity: 'required',
        evidenceStatus: 'explicit',
        sourceClaimIds: ['claim:1'],
        sourceEvidenceIds: ['sam:solicitation:1'],
        naicsCodes: [],
        pscCodes: [],
        keywords: ['food'],
        attributes: {},
        confidence: 1,
        blockers: [],
      }],
    },
    fulfillment: {
      opportunityId: 'opportunity:sam-1',
      structure: 'direct_fulfillment',
      assignments: [{
        providerId: 'provider:1',
        role: 'lead',
        requirementIds: ['requirement:1'],
        evidenceRefs: ['provider:evidence:1'],
        score: 0.9,
      }],
      coveredRequirementIds: ['requirement:1'],
      uncoveredRequirementIds: [],
      blockers: [],
      rationale: ['Covered'],
      requiresHumanApproval: true,
      engagementAuthorized: false,
    },
    commercial: undefined,
    reconciliation: undefined,
    freshness: [],
    engagement: {
      opportunityId: 'opportunity:sam-1',
      status: 'ready_for_human_approval',
      requiredCheckKinds: ['solicitation_terms'],
      checks: [{
        id: 'check:1',
        kind: 'solicitation_terms',
        status: 'passed',
        required: true,
        evidenceRefs: ['sam:compliance:1'],
        sourceRefs: ['sam:terms:1'],
        notes: [],
      }],
      blockers: [],
      warnings: [],
      outreachDraftAllowed: false,
      negotiationPrepAllowed: false,
      outboundSendAuthorized: false,
      contractExecutionAuthorized: false,
    },
    ledgers: [],
    negotiations: [],
    contractReadiness: [],
    contractDrafts: [],
    pursuit: {
      opportunityId: 'opportunity:sam-1',
      status: 'in_progress',
      stages: [{
        stage: 'requirements',
        status: 'done',
        blockers: [],
        evidenceRefs: ['sam:stage:requirements'],
        refs: ['requirement:1'],
      }],
      blockers: [],
      humanGatesRemaining: [],
      executionAuthorized: false,
    },
    ...overrides,
  }
}

{
  const receipt = buildSamSideHustleEvidenceReceipt({
    snapshot: snapshot(),
    experimentId: 'experiment:sam-1',
    spend: 0,
    hours: 2,
  })

  assert.equal(receipt.opportunityId, 'opportunity:sam-1')
  assert.equal(receipt.sourceOwner, 'sam')
  assert.equal(receipt.sourceRecordType, 'pursuit_snapshot')
  assert.deepEqual(receipt.metrics, {
    qualified_opportunities: 1,
    fulfillable_matches: 1,
    compliance_blockers: 0,
  })
  assert.ok(receipt.evidenceRefs.includes('sam:solicitation:1'))
  assert.ok(receipt.evidenceRefs.includes('provider:evidence:1'))
  assert.ok(receipt.evidenceRefs.includes('sam:compliance:1'))
}

{
  const blocked = snapshot({
    fulfillment: {
      ...snapshot().fulfillment!,
      blockers: ['Provider coverage is incomplete'],
      uncoveredRequirementIds: ['requirement:2'],
    },
    engagement: {
      ...snapshot().engagement!,
      status: 'blocked',
      checks: [{
        id: 'check:failed',
        kind: 'solicitation_terms',
        status: 'failed',
        required: true,
        evidenceRefs: ['sam:compliance:failed'],
        sourceRefs: ['sam:terms:1'],
        notes: ['Failed'],
      }],
      blockers: ['Compliance check failed: solicitation_terms'],
    },
  })

  const receipt = buildSamSideHustleEvidenceReceipt({
    snapshot: blocked,
    spend: 5,
    hours: 3,
  })

  assert.equal(receipt.metrics.fulfillable_matches, 0)
  assert.equal(receipt.metrics.compliance_blockers, 1)
  assert.equal(receipt.spend, 5)
  assert.equal(receipt.hours, 3)
}

console.log('side hustle SAM evidence tests passed')

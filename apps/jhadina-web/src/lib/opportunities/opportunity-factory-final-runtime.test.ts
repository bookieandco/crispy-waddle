import { describe, expect, it } from 'vitest'
import { countSamUnauthorizedExternalActions } from '@/lib/money-opportunities/sam-usable-runtime'
import {
  normalizeOpportunityFactoryLiveSnapshot,
  opportunityFactorySoftwareEvidence,
} from './opportunity-factory-final-runtime'

describe('Opportunity Factory production evidence', () => {
  it('normalizes only source-derived non-negative integer counts', () => {
    const snapshot = normalizeOpportunityFactoryLiveSnapshot({
      samClosedLoopCases: 3,
      commercialProviderReceipts: 1,
      realizedCommercialOutcomes: 1,
      unauthorizedExternalActions: 0,
      venture: {
        discoveredSignals: 3,
        boundedExperiments: 1,
        realizedCommercialOutcomes: 1,
        supervisorRepairReceipts: 1,
        spatialRuntimeReceipts: 1,
        unauthorizedExternalActions: 0,
        copiedCreativeAssets: 0,
      },
    })

    expect(snapshot.samClosedLoopCases).toBe(3)
    expect(snapshot.venture.supervisorRepairReceipts).toBe(1)
  })

  it('rejects malformed live evidence instead of silently coercing it', () => {
    expect(() => normalizeOpportunityFactoryLiveSnapshot({
      samClosedLoopCases: '3',
      commercialProviderReceipts: 1,
      realizedCommercialOutcomes: 1,
      unauthorizedExternalActions: 0,
      venture: {},
    })).toThrow(/OPPORTUNITY_FACTORY_EVIDENCE_INVALID|VENTURE_EVIDENCE_INVALID/)
  })

  it('keeps software authority paths singular and governed', () => {
    const evidence = opportunityFactorySoftwareEvidence()
    expect(evidence.duplicateAuthorityPaths).toBe(0)
    expect(evidence.actionGovernanceBound).toBe(true)
    expect(evidence.ventureFactoryBound).toBe(true)
  })

  it('derives SAM authority violations from persisted pursuit flags', () => {
    expect(countSamUnauthorizedExternalActions([
      {
        outreach_authorized: false,
        bid_submission_authorized: false,
        payment_authorized: false,
        contract_execution_authorized: false,
      },
      {
        outreach_authorized: true,
        bid_submission_authorized: false,
        payment_authorized: false,
        contract_execution_authorized: false,
      },
    ])).toBe(1)
  })
})

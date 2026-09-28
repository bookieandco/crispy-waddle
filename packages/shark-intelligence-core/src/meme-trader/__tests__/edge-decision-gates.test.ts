import { describe, expect, it } from 'vitest'
import {
  createEdgeDecisionBundle,
  evaluateEdge001,
  evaluateEdge002,
  evaluateEdge003,
  evaluateEdge004,
  evaluateEdge005,
  evaluateEdge006,
} from '../edge-decision-gates'

const now = '2026-09-27T20:00:00.000Z'
const evidence = ['edge:evidence:1']

function passingReceipts() {
  const edge001 = evaluateEdge001({
    evaluatedAt: now,
    edgeTypes: ['ANALYTICAL'],
    marketMispricingHypothesis: 'The market underprices a verified catalyst.',
    expectedFutureBuyer: 'Later participants responding to the catalyst.',
    evidenceIds: evidence,
  })
  const edge002 = evaluateEdge002({
    evaluatedAt: now,
    marketDisagreementScore: .6,
    expectedUpsideMultiple: 2,
    maxLossFraction: .2,
    evidenceIds: evidence,
  })
  const edge003 = evaluateEdge003({
    evaluatedAt: now,
    portfolioValueUsd: 10_000,
    acceptableLossUsd: 100,
    entryPrice: 1,
    invalidationPrice: .9,
    maxPositionFraction: .05,
    executableLiquidityUsd: 100_000,
    evidenceIds: evidence,
  }).receipt
  const edge004 = evaluateEdge004({
    evaluatedAt: now,
    observedAt: '2026-09-27T19:58:00.000Z',
    trendScore: .8,
    sourceCount: 3,
    catalyst: 'Verified public catalyst.',
    narrative: 'Current narrative.',
    expectedFutureBuyer: 'Later catalyst responders.',
    evidenceIds: evidence,
  })
  const edge005 = evaluateEdge005({
    evaluatedAt: now,
    liquidCapitalUsd: 5_000,
    proposedNotionalUsd: 250,
    reservedCapitalUsd: 1_000,
    minimumDryPowderUsd: 2_000,
    executableExitLiquidityUsd: 10_000,
    evidenceIds: evidence,
  })
  const edge006 = evaluateEdge006({
    evaluatedAt: now,
    remainingMoveFraction: .8,
    executableSizeFraction: .8,
    liquidityConfidence: .9,
    thesisConfidence: .8,
    evidenceIds: evidence,
  }).receipt
  return [edge001, edge002, edge003, edge004, edge005, edge006]
}

describe('EDGE-001 through EDGE-006', () => {
  it('EDGE-001 requires a declared edge, mispricing thesis, future buyer and evidence', () => {
    const blocked = evaluateEdge001({
      evaluatedAt: now,
      edgeTypes: [],
      marketMispricingHypothesis: '',
      expectedFutureBuyer: '',
      evidenceIds: [],
    })
    expect(blocked.disposition).toBe('BLOCK')
    expect(blocked.reasonCodes).toContain('EDGE001_EDGE_DECLARATION_REQUIRED')
    expect(blocked.reasonCodes).toContain('EDGE001_MISPRICING_HYPOTHESIS_REQUIRED')
    expect(blocked.reasonCodes).toContain('EDGE001_FUTURE_BUYER_REQUIRED')
    expect(blocked.canAuthorizeTrade).toBe(false)
  })

  it('EDGE-002 requires disagreement and asymmetric reward relative to bounded loss', () => {
    const blocked = evaluateEdge002({
      evaluatedAt: now,
      marketDisagreementScore: .05,
      expectedUpsideMultiple: 1.1,
      maxLossFraction: .2,
      evidenceIds: evidence,
    })
    expect(blocked.disposition).toBe('BLOCK')
    expect(blocked.reasonCodes).toContain('EDGE002_DISAGREEMENT_INSUFFICIENT')
    expect(blocked.reasonCodes).toContain('EDGE002_ASYMMETRY_INSUFFICIENT')
  })

  it('EDGE-003 sizes from acceptable loss first and then caps by portfolio and liquidity', () => {
    const sized = evaluateEdge003({
      evaluatedAt: now,
      portfolioValueUsd: 10_000,
      acceptableLossUsd: 100,
      entryPrice: 1,
      invalidationPrice: .9,
      maxPositionFraction: .05,
      executableLiquidityUsd: 100_000,
      evidenceIds: evidence,
    })
    expect(sized.receipt.disposition).toBe('PASS')
    expect(sized.lossLimitedNotionalUsd).toBeCloseTo(1000)
    expect(sized.portfolioLimitedNotionalUsd).toBe(500)
    expect(sized.liquidityLimitedNotionalUsd).toBe(2000)
    expect(sized.approvedNotionalUsd).toBe(500)
  })

  it('EDGE-004 rejects stale, single-source or future narrative evidence', () => {
    const stale = evaluateEdge004({
      evaluatedAt: now,
      observedAt: '2026-09-27T19:00:00.000Z',
      trendScore: .8,
      sourceCount: 1,
      catalyst: 'Catalyst',
      narrative: 'Narrative',
      expectedFutureBuyer: 'Future buyer',
      evidenceIds: evidence,
    })
    expect(stale.disposition).toBe('BLOCK')
    expect(stale.reasonCodes).toContain('EDGE004_CROSS_SOURCE_CONFIRMATION_REQUIRED')
    expect(stale.reasonCodes).toContain('EDGE004_NARRATIVE_STALE')
  })

  it('EDGE-005 preserves dry powder and requires executable exit liquidity', () => {
    const blocked = evaluateEdge005({
      evaluatedAt: now,
      liquidCapitalUsd: 1_000,
      proposedNotionalUsd: 600,
      reservedCapitalUsd: 100,
      minimumDryPowderUsd: 500,
      executableExitLiquidityUsd: 1_000,
      evidenceIds: evidence,
    })
    expect(blocked.disposition).toBe('BLOCK')
    expect(blocked.reasonCodes).toContain('EDGE005_DRY_POWDER_BOUNDARY_BREACHED')
    expect(blocked.reasonCodes).toContain('EDGE005_EXIT_LIQUIDITY_INSUFFICIENT')
  })

  it('EDGE-006 rejects early-but-unexecutable or late-low-upside opportunities', () => {
    const blocked = evaluateEdge006({
      evaluatedAt: now,
      remainingMoveFraction: .9,
      executableSizeFraction: .05,
      liquidityConfidence: .5,
      thesisConfidence: .5,
      evidenceIds: evidence,
    })
    expect(blocked.receipt.disposition).toBe('BLOCK')
    expect(blocked.receipt.reasonCodes).toContain('EDGE006_SIZE_TIMING_OPPORTUNITY_INSUFFICIENT')
  })

  it('requires all six passing receipts before the decision bundle passes', () => {
    const pass = createEdgeDecisionBundle(passingReceipts())
    expect(pass.disposition).toBe('PASS')
    expect(pass.receipts).toHaveLength(6)
    expect(pass.canAuthorizeTrade).toBe(false)

    const incomplete = createEdgeDecisionBundle(passingReceipts().slice(0, 5))
    expect(incomplete.disposition).toBe('BLOCK')
    expect(incomplete.reasonCodes).toContain('EDGE006_RECEIPT_REQUIRED')
  })
})

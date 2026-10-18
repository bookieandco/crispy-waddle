import {describe, expect, it} from 'vitest'
import {
  buildPumpMigrationRadarCandidate,
  type MemeTradeAssessment,
  type PumpMigrationRadarCandidate,
} from '@jhadina/shark-intelligence-core/meme-trader'
import type {MemeDraft} from '@jhadina/opportunity-core/meme-venture'
import {validateSharkBotPaperContext, type SharkBotPaperContext} from './bots-paper-context'
import {buildSniperBotPaperReview} from './sniper-bot-paper-review'
import {buildMemeBotPaperReview} from './memebot-paper-review'
import {buildSharkBotsPaperCycle} from './shark-bots-paper-cycle'

const MINT = 'So11111111111111111111111111111111111111112'
const PAIR = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
const EVIDENCE = 'dex:sample-01'
const AT = '2026-10-18T12:05:00Z'
const context: SharkBotPaperContext = {
  caseId: 'shark-case:oct18-001',
  asOf: AT,
  source: {
    sourceClass: 'SHARK_CANONICAL_RESEARCH',
    evidenceId: EVIDENCE,
    eventDigest: 'a'.repeat(64),
    chainId: 'solana',
    tokenMint: MINT,
    pairAddress: PAIR,
    observedAt: '2026-10-18T12:03:59Z',
    availableAt: '2026-10-18T12:04:00Z',
    evidenceIds: [EVIDENCE, 'other:wallet'],
  },
}

const draft: MemeDraft = {
  name: 'Original Meme Experiment',
  ticker: 'ORIG',
  description: 'Original artwork and a transparent creator allocation.',
  totalSupply: 1_000_000,
  poolSupplyPercent: 80,
  creatorSupplyPercent: 10,
  artworkRightsConfirmed: true,
  brandOriginalityConfirmed: true,
  allocationDisclosureConfirmed: true,
  liquidityTermsDisclosureConfirmed: true,
  truthfulPromotionConfirmed: true,
  noArtificialVolumeConfirmed: true,
  noGuaranteedReturnsConfirmed: true,
}

const assessment: MemeTradeAssessment = {
  assessmentId: 'shark:assessment-01',
  assessedAt: '2026-10-18T12:04:30Z',
  token: {chainId: 'solana-mainnet', tokenAddress: MINT},
  tradeType: 'new-pair-speculation',
  marketActivityQuality: {
    score: .75, liquidityScore: .7, volumeScore: .8,
    flowScore: .75, manipulationPenalty: .1, reasons: [],
  },
  supplyControl: {
    score: .2, deployerRisk: .1, concentrationRisk: .2,
    bundledSupplyRisk: .2, liquidityControlRisk: .3, reasons: [],
  },
  holderCohort: {
    score: .7, profitableTrackedWallets: 3,
    accumulatingWallets: 5, distributingWallets: 0, reasons: [],
  },
  attention: {
    score: .75, crossSourceConfirmation: .7,
    engagementQuality: .8, sourceCredibility: .7,
    manipulationPenalty: .1, reasons: [],
  },
  strategyFit: {score: .7, matchedSignals: ['migration'], conflicts: []},
  riskAssessment: {
    marketIntegrity: .1, liquidityRisk: .2, supplyControlRisk: .2,
    holderConcentrationRisk: .2, walletCohortRisk: .2,
    socialManipulationRisk: .1, narrativeFragilityRisk: .2,
    developerRisk: .1, contractRisk: .1, networkRisk: .1,
    attentionQuality: .75, exitLiquidityRisk: .2,
    overallRisk: .25, band: 'candidate',
  },
  rugProtection: {score: 20, disposition: 'ALLOW_CANDIDATE', hardBlockers: [], warnings: [], evidenceIds: [EVIDENCE]},
  thesis: 'Prospective paper-only migration opportunity for risk review.',
  invalidation: {conditions: ['liquidity deterioration'], severity: 'high'},
  positionPlan: {
    maxPositionFraction: .01, entryConditions: [],
    profitTakingConditions: [], exitConditions: [],
  },
  confidence: .65,
  evidenceIds: [EVIDENCE, 'other:wallet'],
  assessmentVersion: 'assessment-fixture-v1',
}

const migration: PumpMigrationRadarCandidate = buildPumpMigrationRadarCandidate({
  observationId: 'curve-01',
  mint: MINT,
  observedAt: '2026-10-18T12:04:00Z',
  availableAt: '2026-10-18T12:04:30Z',
  initialRealTokenReserves: 1000n,
  realTokenReserves: 10n,
  holderCount: 800,
  uniqueBuyerCount: 400,
  volumeAccelerationScore: .96,
  buyPressureScore: .94,
  holderGrowthScore: .9,
  creatorRiskScore: .1,
  clusterRiskScore: .1,
  sniperInventoryRisk: .1,
  rugBlocked: false,
  evidenceIds: [EVIDENCE, 'curve:slot-1'],
})

const pool = {
  inputOrigin: 'OWNER_HYPOTHETICAL_ASSUMPTIONS' as const,
  initialReserveSol: 100,
  initialReserveTokens: 800_000,
  feeBps: 30,
  paperTrades: [{side: 'buy' as const, amount: 1}],
}

describe('SHARK-BOTS.PAPER.01–.04 point-in-time two-specialist boundary', () => {
  it('uses canonical SHARK and existing migration radar to watch, never trade', () => {
    const review = buildSniperBotPaperReview(context, {assessment, migration})
    expect(migration.disposition).toBe('WATCH')
    expect(review.canonicalDisposition).toBe('ASK')
    expect(review.disposition).toBe('WATCH_PAPER')
    expect(review.canonicalDecisionId).toBe('meme-trade-proposal_' + assessment.assessmentId)
    expect(review.sourcePriceConfirmsSellability).toBe(false)
    expect(review.canEnterPaperPosition).toBe(false)
    expect(review.canEnterLivePosition).toBe(false)
    expect(review.actualFills).toBe(0)
    expect(review.authority.canSign).toBe(false)
  })

  it('reuses Token Creator Studio disclosure and simulates only explicit hypothetical inputs', () => {
    const review = buildMemeBotPaperReview(context, {conceptId: 'concept:original', draft, paperPoolScenario: pool})
    expect(review.disposition).toBe('PAPER_PREVIEW_ONLY')
    expect(review.draftReview?.decision).toBe('paper_preview_only')
    expect(review.hypotheticalPool?.source).toBe('HYPOTHETICAL_INPUT')
    expect(review.proposedTokenAddress).toBeNull()
    expect(review.comparativeResearchMint).toBe(MINT)
    expect(review.rightsIndependentlyVerified).toBe(false)
    expect(review.legalReviewCompleted).toBe(false)
    expect(review.actualLaunchedTokens).toBe(0)
    expect(review.realRevenueUsd).toBe(0)
    expect(review.authority.canLaunch).toBe(false)
  })

  it('produces one replay-stable shared packet with pending unscored outcomes and no money permit', () => {
    const request = {context, sniper: {assessment, migration}, memebot: {
      conceptId: 'concept:original', draft, paperPoolScenario: pool,
    }}
    const before = JSON.stringify(request, (_, value) => typeof value === 'bigint' ? value.toString() : value)
    const first = buildSharkBotsPaperCycle(request)
    expect(first).toEqual(buildSharkBotsPaperCycle(request))
    expect(first.receiptId).toContain(context.source.eventDigest)
    expect(first.sniper.disposition).toBe('WATCH_PAPER')
    expect(first.memebot.disposition).toBe('PAPER_PREVIEW_ONLY')
    expect(first.outcomeStatus).toBe('PENDING_GENUINE_LATER_EVIDENCE')
    expect(first.shadowLessonApplied).toBe(false)
    expect(first.actualTradeCount).toBe(0)
    expect(first.actualTokenLaunchCount).toBe(0)
    expect(first.actionOrMoneyPermit).toBeNull()
    expect(JSON.stringify(request, (_, value) => typeof value === 'bigint' ? value.toString() : value)).toBe(before)
  })

  it('DEX-only seven-day evidence never masquerades as canonical SHARK trade review', () => {
    const dex: SharkBotPaperContext = {...context, source: {...context.source, sourceClass: 'DEXSCREENER_INDICATIVE'}}
    expect(buildSniperBotPaperReview(dex, {assessment, migration}).disposition).toBe('DEFER')
    expect(buildSniperBotPaperReview(dex).reasons).toContain('missing-canonical-actor-aware-assessment')
    const packet = buildSharkBotsPaperCycle({context: dex, memebot: {conceptId:'concept:dex-only'}})
    expect(packet.overallDisposition).toBe('ABSTAIN')
  })

  it('blocks high-risk SHARK opportunities despite Pump momentum', () => {
    const unsafe: MemeTradeAssessment = {
      ...assessment,
      riskAssessment: {...assessment.riskAssessment, band: 'blocked', overallRisk: .95},
    }
    expect(buildSniperBotPaperReview(context, {assessment: unsafe, migration}).disposition).toBe('BLOCK')
  })

  it('enforces independent rights, allocations, truthful promotions and no artificial volume', () => {
    const incomplete = {...draft, allocationDisclosureConfirmed: false, noArtificialVolumeConfirmed: false}
    const review = buildMemeBotPaperReview(context, {
      conceptId: 'concept:undisclosed', draft: incomplete, paperPoolScenario: pool,
    })
    expect(review.disposition).toBe('BLOCK')
    expect(review.hypotheticalPool).toBeNull()
    expect(review.reasons).toContain('Creator allocation is not disclosed')
    expect(review.reasons).toContain('Artificial volume is not prohibited')
  })

  it('rejects missing draft behind a claimed simulation, and invalid hypothetical source', () => {
    expect(() => buildMemeBotPaperReview(context, {conceptId: 'concept:no-draft', paperPoolScenario: pool}))
      .toThrow('SHARK_MEMEBOT_POOL_WITHOUT_DRAFT')
    expect(() => buildMemeBotPaperReview(context, {
      conceptId: 'concept:bad-source', draft,
      paperPoolScenario: {...pool, inputOrigin: 'DEXSCREENER_LIVE' as never},
    })).toThrow('SHARK_MEMEBOT_SIMULATION_SOURCE_INVALID')
  })

  it('prevents cross-chain/mint assessment substitution and future-informed reviews', () => {
    expect(() => buildSniperBotPaperReview(context, {
      assessment: {...assessment, token: {...assessment.token, tokenAddress: PAIR}}, migration,
    })).toThrow('SHARK_SNIPER_ASSESSMENT_LINEAGE_INVALID')
    expect(() => buildSniperBotPaperReview(context, {
      assessment, migration: {...migration, availableAt: '2026-10-18T12:06:00Z'},
    })).toThrow('SHARK_SNIPER_MIGRATION_LINEAGE_INVALID')
    expect(() => buildSniperBotPaperReview(context, {
      assessment: {...assessment, assessedAt: '2026-10-18T12:02:00Z'}, migration,
    })).toThrow('SHARK_SNIPER_ASSESSMENT_LINEAGE_INVALID')
  })

  it('rejects future, forged or conflicting evidence and admits only read-only context', () => {
    expect(() => validateSharkBotPaperContext({
      ...context, source: {...context.source, availableAt: '2026-10-18T12:07:00Z'},
    })).toThrow('SHARK_BOTS_SOURCE_LOOKAHEAD_FORBIDDEN')
    expect(() => validateSharkBotPaperContext({
      ...context, source: {...context.source, chainId: 'ethereum' as never},
    })).toThrow('SHARK_BOTS_SOURCE_IDENTITY_INVALID')
    expect(() => validateSharkBotPaperContext({
      ...context, source: {...context.source, eventDigest: 'tampered'},
    })).toThrow('SHARK_BOTS_SOURCE_IDENTITY_INVALID')
    expect(() => validateSharkBotPaperContext({
      ...context, source: {...context.source, evidenceIds: [EVIDENCE, EVIDENCE]},
    })).toThrow('SHARK_BOTS_SOURCE_EVIDENCE_INVALID')
    expect(() => validateSharkBotPaperContext({
      ...context, source: {...context.source, observedAt: '2026-10-18T12:08:00Z'},
    })).toThrow('SHARK_BOTS_SOURCE_LOOKAHEAD_FORBIDDEN')
  })

  it('rejects stale quotes for the 15-minute paper-scout gate', () => {
    const stale = {...context, asOf: '2026-10-18T12:40:00Z'}
    const result = buildSniperBotPaperReview(stale, {assessment, migration})
    expect(result.disposition).toBe('DEFER')
    expect(result.reasons).toContain('market-snapshot-too-old-for-15-minute-paper-review')
  })

  it('never interprets WATCH as an owner/money mandate or independently verified evidence', () => {
    const result = buildSharkBotsPaperCycle({context, sniper: {assessment, migration}, memebot: {
      conceptId: 'concept:original', draft,
    }})
    expect(result.independentSourceVerified).toBe(false)
    expect(result.authority.canExecute).toBe(false)
    expect(result.authority.canTrade).toBe(false)
    expect(result.authority.canLaunch).toBe(false)
    expect(result.authority.canSpend).toBe(false)
    expect(result.authority.canPublish).toBe(false)
    expect(result.authority.canChangePolicies).toBe(false)
    expect(result.sniper.simulatedFills).toBe(0)
  })
  it('fails closed when a protective rug veto contradicts the general risk band', () => {
    const contradictory: MemeTradeAssessment = {
      ...assessment,
      rugProtection: {...assessment.rugProtection, disposition: 'BLOCK', hardBlockers: ['freeze authority active']},
      riskAssessment: {...assessment.riskAssessment, band: 'candidate'},
    }
    const review = buildSniperBotPaperReview(context, {assessment: contradictory, migration})
    expect(review.canonicalDisposition).toBe('ASK')
    expect(review.disposition).toBe('BLOCK')
    expect(review.reasons).toContain('canonical-rug-protection-veto')
    const combined = buildSharkBotsPaperCycle({
      context, sniper: {assessment: contradictory, migration},
      memebot: {conceptId: 'concept:valid-but-sniper-blocked', draft},
    })
    expect(combined.memebot.disposition).toBe('PAPER_PREVIEW_ONLY')
    expect(combined.sniper.disposition).toBe('BLOCK')
    expect(combined.overallDisposition).toBe('ABSTAIN')
  })

  it('does not upgrade a review-required rug result into a paper watch', () => {
    const caution: MemeTradeAssessment = {
      ...assessment,
      rugProtection: {...assessment.rugProtection, disposition: 'REVIEW', warnings: ['authority is unverified']},
    }
    const review = buildSniperBotPaperReview(context, {assessment: caution, migration})
    expect(review.disposition).toBe('DEFER')
    expect(review.reasons).toContain('canonical-rug-protection-review-required')
  })

  it('rejects stale migration evidence even with a fresh market observation', () => {
    const old = {...migration, observedAt: '2026-10-18T11:29:00Z', availableAt: '2026-10-18T11:30:00Z'}
    const result = buildSniperBotPaperReview(context, {assessment, migration: old})
    expect(result.disposition).toBe('DEFER')
    expect(result.reasons).toContain('migration-evidence-too-old-for-15-minute-paper-review')
  })

  it('rejects contradictory WATCH migration with unresolved blockers or missing checks', () => {
    const contradictory: PumpMigrationRadarCandidate = {
      ...migration, disposition: 'WATCH',
      blockers: ['creator-risk-high'], missingChecks: ['authority-control'],
    }
    const review = buildSniperBotPaperReview(context, {assessment, migration: contradictory})
    expect(review.disposition).toBe('DEFER')
    expect(review.reasons).toContain('migration-watch-inconsistent-with-unresolved-checks')
  })

})

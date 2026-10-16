import { strict as assert } from 'node:assert'
import {
  MEME_SERVICE_THESIS,
  MEME_SOURCE_REVIEWS,
  MEME_VENTURE_ACCEPTANCE,
  MEME_VENTURE_AUTHORITIES,
  evaluateMemeVentureGoNoGo,
  proposeMemeDemandExperiment,
  quoteMemeService,
  reviewMemeDraft,
  simulateMemePool,
  type MemeDraft,
} from './meme-venture.js'

const draft: MemeDraft = {
  name: 'Cactus Astronaut',
  ticker: 'CACTUS',
  description: 'Original surreal cactus exploration mascot for a fictional community.',
  totalSupply: 1_000_000_000,
  poolSupplyPercent: 90,
  creatorSupplyPercent: 10,
  artworkRightsConfirmed: true,
  brandOriginalityConfirmed: true,
  allocationDisclosureConfirmed: true,
  liquidityTermsDisclosureConfirmed: true,
  truthfulPromotionConfirmed: true,
  noArtificialVolumeConfirmed: true,
  noGuaranteedReturnsConfirmed: true,
}

// 01: 3 actual code-source reviews are not evidence of buyer demand.
assert.equal(MEME_SOURCE_REVIEWS.length, 3)
assert(MEME_SOURCE_REVIEWS.every((item) => item.demandEvidence === false))
assert(MEME_SOURCE_REVIEWS.every((item) => item.recommendation === 'reference_only'))

// 02: prices are assumptions; never appear as sales or validated demand.
assert.equal(MEME_SERVICE_THESIS.customerDemandValidated, false)
const quote = quoteMemeService({ tier: 'creation_prep', estimatedLaborHours: 2, estimatedLaborCostPerHourUsd: 25, estimatedOtherCostUsd: 10 })
assert.equal(quote.proposedPriceUsd, 149)
assert.equal(quote.estimatedCostUsd, 60)
assert.equal(quote.estimatedGrossMarginUsd, 89)
assert.equal(quote.actualRevenueUsd, 0)
assert.equal(quote.paymentAuthorized, false)
assert.equal(quoteMemeService({ tier: 'brand_preview', estimatedLaborHours: 1, estimatedLaborCostPerHourUsd: 0, estimatedOtherCostUsd: 0 }).proposedPriceUsd, 49)
assert.throws(() => quoteMemeService({ tier: 'creation_prep', estimatedLaborHours: NaN, estimatedLaborCostPerHourUsd: 20, estimatedOtherCostUsd: 0 }))
assert.throws(() => quoteMemeService({ tier: 'creation_prep', estimatedLaborHours: -1, estimatedLaborCostPerHourUsd: 20, estimatedOtherCostUsd: 0 }))

// 03: no copied brand, hidden allocations, missing rights, bogus return claims or manipulation.
const approved = reviewMemeDraft(draft)
assert.equal(approved.decision, 'paper_preview_only')
assert.equal(approved.creatorTokenAllocation, 100_000_000)
assert.equal(approved.poolTokenAllocation, 900_000_000)
assert.equal(approved.unsoldOrUnallocatedTokens, 0)
assert.equal(approved.launchAuthorized, false)
assert.equal(approved.legalReviewRequired, true)
assert.equal(reviewMemeDraft({ ...draft, brandOriginalityConfirmed: false }).decision, 'blocked')
assert.equal(reviewMemeDraft({ ...draft, noArtificialVolumeConfirmed: false }).decision, 'blocked')
assert.equal(reviewMemeDraft({ ...draft, noGuaranteedReturnsConfirmed: false }).decision, 'blocked')
assert.equal(reviewMemeDraft({ ...draft, allocationDisclosureConfirmed: false }).metadata, null)
assert.throws(() => reviewMemeDraft({ ...draft, ticker: 'no spaces' }))
assert.throws(() => reviewMemeDraft({ ...draft, poolSupplyPercent: 91 }))
assert.throws(() => reviewMemeDraft({ ...draft, totalSupply: Infinity }))
assert.throws(() => reviewMemeDraft({ ...draft, totalSupply: -1 }))

// 04: authority is inherited, and there's no new mint/publish/spend path.
assert.equal(MEME_VENTURE_AUTHORITIES.authority, 'OPPORTUNITY_ONLY')
for (const key of ['mintAuthorized', 'externalActionAuthorized', 'paymentAuthorized',
  'moneyMovementAuthorized', 'signerEnabled', 'publishingAuthorized', 'outreachAuthorized'] as const) {
  assert.equal(MEME_VENTURE_AUTHORITIES[key], false)
}

// 05: fee-aware constant-product AMM paper physics; replay should be identical.
const scenario = {
  initialReserveSol: 2,
  initialReserveTokens: 900_000_000,
  feeBps: 30,
  paperTrades: [{ side: 'buy', amount: 0.25 }, { side: 'sell', amount: 50_000_000 }] as const,
}
const paper = simulateMemePool(scenario)
assert.equal(JSON.stringify(paper), JSON.stringify(simulateMemePool(scenario)))
assert.equal(paper.receipts.length, 2)
assert.equal(paper.receipts[0].previousEventId, null)
assert.equal(paper.receipts[1].previousEventId, paper.receipts[0].eventId)
assert(paper.receipts.every((record) => record.hypothetical))
assert(paper.receipts[0].amountOut > 0)
assert(paper.receipts[0].slippagePercentExcludingFee > 0)
assert(paper.receipts.every((record) => record.slippagePercentExcludingFee >= 0 && record.slippagePercentExcludingFee < 100))
assert(paper.receipts[1].amountOut > 0)
assert(paper.reserveSol > 0 && paper.reserveTokens > 0)
assert(paper.reserveSol * paper.reserveTokens >= scenario.initialReserveSol * scenario.initialReserveTokens * (1 - 1e-12))
assert.equal(paper.ownerRevenueRealizedUsd, 0)
assert.equal(paper.feeRevenueRealizedSol, 0)
assert.equal(paper.liquidityWithdrawableBySimulator, false)
const noTrades = simulateMemePool({ ...scenario, paperTrades: [] })
assert.equal(noTrades.reserveSol, 2)
assert.equal(noTrades.reserveTokens, 900_000_000)
assert.throws(() => simulateMemePool({ ...scenario, feeBps: -1 }))
assert.throws(() => simulateMemePool({ ...scenario, initialReserveSol: 0 }))
assert.throws(() => simulateMemePool({ ...scenario, paperTrades: [{ side: 'buy', amount: -1 }] }))
assert.throws(() => simulateMemePool({ ...scenario, paperTrades: Array.from({ length: 101 }, () => ({ side: 'buy' as const, amount: 0.01 })) }))

// 06: mock metadata and hypothetical quote, never a valid mint or a payment link.
assert.equal(approved.metadata?.name, 'Cactus Astronaut')
assert.equal(quote.kind, 'NONBINDING_HYPOTHETICAL_QUOTE')

// 07: prospective demand test is only a bounded proposal.
const experiment = proposeMemeDemandExperiment({ durationDays: 7, minimumIndependentResponses: 5, priceHypothesisUsd: 149 })
assert.equal(experiment.status, 'PROPOSAL_ONLY')
assert.equal(experiment.maxSpendUsd, 0)
assert.equal(experiment.publicationAuthorized, false)
assert.equal(experiment.started, false)
assert.equal(experiment.verifiedResponses, 0)
assert.throws(() => proposeMemeDemandExperiment({ durationDays: 8, minimumIndependentResponses: 5, priceHypothesisUsd: 149 }))
assert.throws(() => proposeMemeDemandExperiment({ durationDays: 7, minimumIndependentResponses: 0, priceHypothesisUsd: 149 }))

// 08: even all Boolean evidence does not turn this service into an execution authority.
const blocked = evaluateMemeVentureGoNoGo({
  independentLegalClearance: false,
  securityReviewApproved: false,
  verifiedDemandReceipts: 0,
  reconciledCommercialReceipts: 0,
  approvedActionCoreCommissioning: false,
})
assert.equal(blocked.status, 'HOLD')
assert.equal(blocked.blockers.length, 5)
const future = evaluateMemeVentureGoNoGo({
  independentLegalClearance: true,
  securityReviewApproved: true,
  verifiedDemandReceipts: 5,
  reconciledCommercialReceipts: 1,
  approvedActionCoreCommissioning: true,
})
assert.equal(future.status, 'READY_FOR_SEPARATE_AUTHORITY_REVIEW')
assert.equal(future.launchAuthorized, false)
assert.equal(future.moneyMovementAuthorized, false)
assert.equal(future.revenueAttestedByThisModule, false)
assert.equal(MEME_VENTURE_ACCEPTANCE.liveStatus, 'BLOCKED_UNTIL_EXTERNAL_EVIDENCE')

console.log('MEME-VENTURE.01-.08 paper-only domain assertions passed')

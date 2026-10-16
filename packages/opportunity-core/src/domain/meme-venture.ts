/**
 * MEME-VENTURE.01-.08: research-only Token Creator Studio.
 *
 * This module is intentionally deterministic and offline: no RPC, signer,
 * token deployment, custody, liquidity withdrawals, network calls or sales.
 * Do not confuse simulated observations with real trades or revenue.
 */
export const MEME_VENTURE_CANDIDATE_ID = 'venture:token-launch-services-2026-10-15' as const

export const MEME_VENTURE_AUTHORITIES = Object.freeze({
  authority: 'OPPORTUNITY_ONLY' as const,
  automationMaturity: 'unvalidated' as const,
  externalActionAuthorized: false as const,
  mintAuthorized: false as const,
  publishingAuthorized: false as const,
  outreachAuthorized: false as const,
  paymentAuthorized: false as const,
  moneyMovementAuthorized: false as const,
  signerEnabled: false as const,
})

export type MemeSourceReview = {
  repositoryUrl: string
  observedAt: string
  role: 'math_reference' | 'solana_reference' | 'evm_reference'
  observedFiles: readonly string[]
  securityFindings: readonly string[]
  licenseAssessment: 'declared_mit_file_missing' | 'declared_mit' | 'verified_mit'
  recommendation: 'reference_only'
  demandEvidence: false
}

export const MEME_SOURCE_REVIEWS: readonly MemeSourceReview[] = Object.freeze([
  {
    repositoryUrl: 'https://github.com/metadev-xi/Memecoin-Launchpad-Platform',
    observedAt: '2026-10-15',
    role: 'math_reference',
    observedFiles: ['README.md', 'bondingCurveModel.js'],
    securityFindings: ['Not a deployable launchpad; verify fractional exponent behavior, price calculations and simulated burns.'],
    licenseAssessment: 'declared_mit_file_missing',
    recommendation: 'reference_only',
    demandEvidence: false,
  },
  {
    repositoryUrl: 'https://github.com/techleadhd/memecoin-maker',
    observedAt: '2026-10-15',
    role: 'solana_reference',
    observedFiles: ['README.md', 'index.js', 'keygen.js', 'package.json'],
    securityFindings: ['Private key is pasted into a source file and serialized to disk.', 'Mainnet RPC is configured by default.'],
    licenseAssessment: 'declared_mit',
    recommendation: 'reference_only',
    demandEvidence: false,
  },
  {
    repositoryUrl: 'https://github.com/rtb-12/MemeCoin',
    observedAt: '2026-10-15',
    role: 'evm_reference',
    observedFiles: ['README.md', 'LICENSE', 'Contract/src/Token.sol', 'Contract/src/TokenFactory.sol', 'Contract/test/TokenFactory.t.sol'],
    securityFindings: ['Trading state does not appear to be assigned before withdrawals.', 'Withdrawal balances are not decremented.', 'Token supply and liquidity accounting require an independent audit.'],
    licenseAssessment: 'verified_mit',
    recommendation: 'reference_only',
    demandEvidence: false,
  },
])

export const MEME_SERVICE_THESIS = Object.freeze({
  family: 'software_apps' as const,
  secondaryFamily: 'creator_monetization' as const,
  buyer: 'Independent creators seeking original token branding and technical education',
  paidProblemHypothesis: 'Creators may pay for rights-aware branding, metadata previews and transparent token-launch preparation.',
  solutionHypothesis: 'A noncustodial preview and fixed-scope setup service may reduce effort without offering investment outcomes.',
  differentiation: 'Original IP, explicit founder allocations, paper economics, documented handoff and approval-first operations.',
  disconfirmingEvidenceToCollect: [
    'Customers may prefer existing free token creation tools.',
    'Prospects may not pay for branding or audit-ready disclosures.',
    'Legal reviews and customer support may exceed the expected service margin.',
    'An original meme brand may have no organic audience.',
  ],
  servicePriceHypothesisUsd: 149,
  customerDemandValidated: false as const,
  priceValidated: false as const,
  legallyCleared: false as const,
  actualRevenueUsd: 0 as const,
})

const requirePositive = (n: number, field: string): void => {
  if (!Number.isFinite(n) || n <= 0) throw new Error(field + ' must be finite and positive')
}
const requireNonNegative = (n: number, field: string): void => {
  if (!Number.isFinite(n) || n < 0) throw new Error(field + ' must be finite and nonnegative')
}
const money = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
const clampText = (value: string, name: string, maxLength: number) => {
  if (typeof value !== 'string' || value.trim().length < 2 || value.trim().length > maxLength) {
    throw new Error(name + ' must be 2–' + maxLength + ' characters')
  }
  return value.trim()
}

export type MemeDraft = {
  name: string
  ticker: string
  description: string
  totalSupply: number
  poolSupplyPercent: number
  creatorSupplyPercent: number
  artworkRightsConfirmed: boolean
  brandOriginalityConfirmed: boolean
  allocationDisclosureConfirmed: boolean
  liquidityTermsDisclosureConfirmed: boolean
  truthfulPromotionConfirmed: boolean
  noArtificialVolumeConfirmed: boolean
  noGuaranteedReturnsConfirmed: boolean
}
export type MemeDraftReview = {
  decision: 'blocked' | 'paper_preview_only'
  blockers: string[]
  metadata: { name: string; symbol: string; description: string; supply: number } | null
  creatorTokenAllocation: number
  poolTokenAllocation: number
  unsoldOrUnallocatedTokens: number
  legalReviewRequired: true
  independentRightsReviewRequired: true
  launchAuthorized: false
  moneyMovementAuthorized: false
}

export function reviewMemeDraft(input: MemeDraft): MemeDraftReview {
  const name = clampText(input.name, 'name', 40)
  const description = clampText(input.description, 'description', 280)
  if (typeof input.ticker !== 'string' || !/^[A-Z0-9]{2,10}$/.test(input.ticker)) {
    throw new Error('Ticker must contain 2–10 uppercase letters or digits')
  }
  requirePositive(input.totalSupply, 'totalSupply')
  if (!Number.isSafeInteger(input.totalSupply) || input.totalSupply > 1_000_000_000_000) {
    throw new Error('totalSupply must be a safe integer no greater than 1 trillion')
  }
  requireNonNegative(input.poolSupplyPercent, 'poolSupplyPercent')
  requireNonNegative(input.creatorSupplyPercent, 'creatorSupplyPercent')
  if (input.poolSupplyPercent > 100 || input.creatorSupplyPercent > 100 ||
      input.poolSupplyPercent + input.creatorSupplyPercent > 100) {
    throw new Error('Token allocations exceed 100%')
  }
  const confirmations: Array<[keyof MemeDraft, string]> = [
    ['artworkRightsConfirmed', 'Artwork rights not confirmed'],
    ['brandOriginalityConfirmed', 'Original brand/name not confirmed'],
    ['allocationDisclosureConfirmed', 'Creator allocation is not disclosed'],
    ['liquidityTermsDisclosureConfirmed', 'Liquidity terms are not disclosed'],
    ['truthfulPromotionConfirmed', 'Truthful promotion is not confirmed'],
    ['noArtificialVolumeConfirmed', 'Artificial volume is not prohibited'],
    ['noGuaranteedReturnsConfirmed', 'Guaranteed-return claims are not prohibited'],
  ]
  const blockers = confirmations.filter(([key]) => input[key] !== true).map(([, reason]) => reason)
  // The self-attestations are only preliminary checks; they do not prove ownership or regulatory clearance.
  return {
    decision: blockers.length ? 'blocked' : 'paper_preview_only',
    blockers,
    metadata: blockers.length ? null : { name, symbol: input.ticker, description, supply: input.totalSupply },
    creatorTokenAllocation: input.totalSupply * input.creatorSupplyPercent / 100,
    poolTokenAllocation: input.totalSupply * input.poolSupplyPercent / 100,
    unsoldOrUnallocatedTokens: input.totalSupply * (100 - input.poolSupplyPercent - input.creatorSupplyPercent) / 100,
    legalReviewRequired: true,
    independentRightsReviewRequired: true,
    launchAuthorized: false,
    moneyMovementAuthorized: false,
  }
}

export type MemePaperTrade = { side: 'buy' | 'sell'; amount: number }
export type MemePaperEvent = {
  eventId: string
  previousEventId: string | null
  sequence: number
  hypothetical: true
  side: 'buy' | 'sell'
  amountIn: number
  amountOut: number
  feeAmountInInputUnits: number
  feeAsset: 'SOL' | 'TOKEN'
  slippagePercentExcludingFee: number
  spotPriceAfterSolPerToken: number
  reserveSolAfter: number
  reserveTokensAfter: number
}
export type MemePaperSimulation = {
  mode: 'PAPER_ONLY'
  source: 'HYPOTHETICAL_INPUT'
  initialReserveSol: number
  initialReserveTokens: number
  reserveSol: number
  reserveTokens: number
  feeBps: number
  spotPriceSolPerToken: number
  feeRevenueRealizedSol: 0
  ownerRevenueRealizedUsd: 0
  receipts: MemePaperEvent[]
  noExternalExecution: true
  liquidityWithdrawableBySimulator: false
}

export function simulateMemePool(input: {
  initialReserveSol: number
  initialReserveTokens: number
  feeBps: number
  paperTrades: readonly MemePaperTrade[]
}): MemePaperSimulation {
  requirePositive(input.initialReserveSol, 'initialReserveSol')
  requirePositive(input.initialReserveTokens, 'initialReserveTokens')
  requireNonNegative(input.feeBps, 'feeBps')
  if (input.feeBps > 1000 || !Number.isInteger(input.feeBps)) throw new Error('feeBps must be 0–1000')
  if (!Array.isArray(input.paperTrades) || input.paperTrades.length > 100) {
    throw new Error('paperTrades must be an array of at most 100 trades')
  }
  let sol = input.initialReserveSol
  let tokens = input.initialReserveTokens
  const receipts: MemePaperEvent[] = []
  for (const trade of input.paperTrades) {
    if (trade.side !== 'buy' && trade.side !== 'sell') throw new Error('Unknown trade side')
    requirePositive(trade.amount, 'trade.amount')
    const isBuy = trade.side === 'buy'
    const reserveIn = isBuy ? sol : tokens
    const reserveOut = isBuy ? tokens : sol
    // Input fees stay in the AMM reserve; nothing is paid or attributed to Jhadina.
    const fee = trade.amount * input.feeBps / 10_000
    const effectiveInput = trade.amount - fee
    const amountOut = reserveOut * effectiveInput / (reserveIn + effectiveInput)
    const theoreticalOutputWithoutPriceImpact = (reserveOut / reserveIn) * effectiveInput
    const slippagePercentExcludingFee = 100 * (1 - amountOut / theoreticalOutputWithoutPriceImpact)
    const nextIn = reserveIn + trade.amount
    const nextOut = reserveOut - amountOut
    if (!(nextOut > 0) || !Number.isFinite(nextIn) || !Number.isFinite(nextOut) || amountOut <= 0) {
      throw new Error('Trade would produce invalid paper reserves')
    }
    if (isBuy) { sol = nextIn; tokens = nextOut }
    else { tokens = nextIn; sol = nextOut }
    const previousEventId = receipts.length ? receipts[receipts.length - 1].eventId : null
    receipts.push({
      eventId: 'meme-paper:' + (receipts.length + 1),
      previousEventId,
      sequence: receipts.length + 1,
      hypothetical: true,
      side: trade.side,
      amountIn: trade.amount,
      amountOut,
      feeAmountInInputUnits: fee,
      feeAsset: isBuy ? 'SOL' : 'TOKEN',
      slippagePercentExcludingFee,
      spotPriceAfterSolPerToken: sol / tokens,
      reserveSolAfter: sol,
      reserveTokensAfter: tokens,
    })
  }
  return {
    mode: 'PAPER_ONLY',
    source: 'HYPOTHETICAL_INPUT',
    initialReserveSol: input.initialReserveSol,
    initialReserveTokens: input.initialReserveTokens,
    reserveSol: sol,
    reserveTokens: tokens,
    feeBps: input.feeBps,
    spotPriceSolPerToken: sol / tokens,
    feeRevenueRealizedSol: 0,
    ownerRevenueRealizedUsd: 0,
    receipts,
    noExternalExecution: true,
    liquidityWithdrawableBySimulator: false,
  }
}

export type MemeServiceTier = 'brand_preview' | 'creation_prep'
const PRICES: Record<MemeServiceTier, number> = { brand_preview: 49, creation_prep: 149 }

export function quoteMemeService(input: {
  tier: MemeServiceTier
  estimatedLaborHours: number
  estimatedLaborCostPerHourUsd: number
  estimatedOtherCostUsd: number
}) {
  if (!Object.prototype.hasOwnProperty.call(PRICES, input.tier)) throw new Error('Unknown service tier')
  requireNonNegative(input.estimatedLaborHours, 'estimatedLaborHours')
  requireNonNegative(input.estimatedLaborCostPerHourUsd, 'estimatedLaborCostPerHourUsd')
  requireNonNegative(input.estimatedOtherCostUsd, 'estimatedOtherCostUsd')
  const proposedPriceUsd = PRICES[input.tier]
  const estimatedCost = input.estimatedLaborHours * input.estimatedLaborCostPerHourUsd + input.estimatedOtherCostUsd
  if (!Number.isFinite(estimatedCost)) throw new Error('Estimated cost overflow')
  const estimatedCostUsd = money(estimatedCost)
  return {
    kind: 'NONBINDING_HYPOTHETICAL_QUOTE' as const,
    tier: input.tier,
    proposedPriceUsd,
    estimatedCostUsd,
    estimatedGrossMarginUsd: money(proposedPriceUsd - estimatedCostUsd),
    costModelIsAssumed: true as const,
    customerDemandVerified: false as const,
    paymentAuthorized: false as const,
    actualRevenueUsd: 0 as const,
  }
}

export type MemeDemandExperiment = {
  status: 'PROPOSAL_ONLY'
  channel: 'approved_owned_landing_page'
  question: string
  priceHypothesisUsd: number
  maxSpendUsd: 0
  durationDays: number
  minimumIndependentResponses: number
  requiresCanonicalApproval: true
  outreachAuthorized: false
  publicationAuthorized: false
  started: false
  verifiedResponses: 0
  realizedRevenueUsd: 0
}

export function proposeMemeDemandExperiment(input: {
  durationDays: number
  minimumIndependentResponses: number
  priceHypothesisUsd: number
}): MemeDemandExperiment {
  if (!Number.isInteger(input.durationDays) || input.durationDays < 1 || input.durationDays > 7) {
    throw new Error('durationDays must be 1–7')
  }
  if (!Number.isSafeInteger(input.minimumIndependentResponses) || input.minimumIndependentResponses < 5) {
    throw new Error('minimumIndependentResponses must be at least 5')
  }
  requirePositive(input.priceHypothesisUsd, 'priceHypothesisUsd')
  return {
    status: 'PROPOSAL_ONLY',
    channel: 'approved_owned_landing_page',
    question: 'Will creators opt into a transparent, original token branding and metadata-preview service at the proposed price?',
    priceHypothesisUsd: input.priceHypothesisUsd,
    maxSpendUsd: 0,
    durationDays: input.durationDays,
    minimumIndependentResponses: input.minimumIndependentResponses,
    requiresCanonicalApproval: true,
    outreachAuthorized: false,
    publicationAuthorized: false,
    started: false,
    verifiedResponses: 0,
    realizedRevenueUsd: 0,
  }
}

export const MEME_VENTURE_ACCEPTANCE = Object.freeze({
  '01': 'REFERENCE_REVIEW_RECORDED',
  '02': 'DEMAND_AND_PRICE_HYPOTHESES_DOCUMENTED_NOT_VALIDATED',
  '03': 'SELF_ATTESTATION_AND_ORIGINALITY_BLOCKERS_MODELED_INDEPENDENT_REVIEW_REQUIRED',
  '04': 'CANONICAL_DOMAIN_BOUNDARIES_DECLARED_NO_NEW_AUTHORITY',
  '05': 'OFFLINE_POOL_SIMULATOR_AND_HYPOTHETICAL_RECEIPTS',
  '06': 'PAPER_ONLY_PREVIEW_AND_NONBINDING_QUOTE',
  '07': 'ZERO_SPEND_EXPERIMENT_PROPOSED_NOT_ADMITTED_OR_RUN',
  '08': 'GO_NO_GO_GATED_NO_REVENUE_OR_ONCHAIN_ACTION',
  liveStatus: 'BLOCKED_UNTIL_EXTERNAL_EVIDENCE',
  securityReviewComplete: false,
  independentLegalClearance: false,
  realCustomerDemandProven: false,
  realCommercialReceipts: 0,
  realTradingOrMintEnabled: false,
  moneyMovementAuthorized: false,
})

export function evaluateMemeVentureGoNoGo(evidence: {
  independentLegalClearance: boolean
  securityReviewApproved: boolean
  verifiedDemandReceipts: number
  reconciledCommercialReceipts: number
  approvedActionCoreCommissioning: boolean
}) {
  requireNonNegative(evidence.verifiedDemandReceipts, 'verifiedDemandReceipts')
  requireNonNegative(evidence.reconciledCommercialReceipts, 'reconciledCommercialReceipts')
  const blockers = [
    !evidence.independentLegalClearance ? 'Independent legal review missing' : '',
    !evidence.securityReviewApproved ? 'Independent security review missing' : '',
    evidence.verifiedDemandReceipts < 5 ? 'Five independent demand receipts missing' : '',
    evidence.reconciledCommercialReceipts < 1 ? 'Reconciled commercial receipt missing' : '',
    !evidence.approvedActionCoreCommissioning ? 'Action Core commissioning missing' : '',
  ].filter(Boolean)
  return {
    status: blockers.length ? 'HOLD' as const : 'READY_FOR_SEPARATE_AUTHORITY_REVIEW' as const,
    blockers,
    // Even all evidence flags cannot authorize launching or spending in this module.
    launchAuthorized: false as const,
    moneyMovementAuthorized: false as const,
    revenueAttestedByThisModule: false as const,
  }
}

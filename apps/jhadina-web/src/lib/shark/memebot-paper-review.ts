/**
 * SHARK-BOTS.PAPER.03 — MemeBot consumes existing Token Creator Studio
 * risk/disclosure review and deterministic hypothetical pool simulator.
 *
 * The SHARK mint is a COMPARISON/RESEARCH token, never the proposed
 * launched token address. This cannot mint, publish, market, sell, sign,
 * withdraw pool liquidity or create actual revenue.
 */
import {
  reviewMemeDraft,
  simulateMemePool,
  type MemeDraft,
  type MemeDraftReview,
  type MemePaperSimulation,
  type MemePaperTrade,
} from '@jhadina/opportunity-core/meme-venture'
import {
  validateSharkBotPaperContext,
  type SharkBotPaperContext,
  SHARK_BOTS_PAPER_AUTHORITY,
} from './bots-paper-context'

export type MemeBotPaperPoolScenario = Readonly<{
  initialReserveSol: number
  initialReserveTokens: number
  feeBps: number
  paperTrades: readonly MemePaperTrade[]
  inputOrigin: 'OWNER_HYPOTHETICAL_ASSUMPTIONS'
}>

export type MemeBotPaperInput = Readonly<{
  conceptId: string
  draft?: MemeDraft
  paperPoolScenario?: MemeBotPaperPoolScenario
}>

export type MemeBotPaperReview = Readonly<{
  schema: 'SHARK-MEMEBOT-PAPER-03'
  specialist: 'MEME_BOT'
  conceptId: string
  caseId: string
  receiptIdentity: string
  comparativeResearchMint: string
  proposedTokenAddress: null
  asOf: string
  disposition: 'DEFER' | 'BLOCK' | 'PAPER_PREVIEW_ONLY'
  draftReview: MemeDraftReview | null
  hypotheticalPool: MemePaperSimulation | null
  reasons: readonly string[]
  sourceEvidenceIds: readonly string[]
  sourceEventDigest: string
  rightsIndependentlyVerified: false
  legalReviewCompleted: false
  realRevenueUsd: 0
  actualLaunchedTokens: 0
  disclosureOrPaperStudyIsLaunchApproval: false
  authority: typeof SHARK_BOTS_PAPER_AUTHORITY
}>

const conceptPattern = /^[a-zA-Z0-9:_./-]{2,160}$/

export function buildMemeBotPaperReview(
  context: SharkBotPaperContext,
  input: MemeBotPaperInput,
): MemeBotPaperReview {
  const validated = validateSharkBotPaperContext(context)
  if (!input || !conceptPattern.test(input.conceptId ?? '')) {
    throw new Error('SHARK_MEMEBOT_CONCEPT_ID_REQUIRED')
  }
  if (input.paperPoolScenario && !input.draft) {
    throw new Error('SHARK_MEMEBOT_POOL_WITHOUT_DRAFT')
  }
  let draftReview: MemeDraftReview | null = null
  let hypotheticalPool: MemePaperSimulation | null = null
  const reasons: string[] = []

  if (!input.draft) {
    reasons.push('creator-studio-draft-not-supplied')
  } else {
    // Reuse the canonical disclosures/rights/tokenomics gates; a checked
    // checkbox remains a claim requiring independent human/legal review.
    draftReview = reviewMemeDraft(input.draft)
    reasons.push(...draftReview.blockers)
    if (draftReview.decision === 'paper_preview_only') {
      reasons.push('ownership-and-legal-clearance-still-unverified')
      if (input.paperPoolScenario) {
        if (input.paperPoolScenario.inputOrigin !== 'OWNER_HYPOTHETICAL_ASSUMPTIONS') {
          throw new Error('SHARK_MEMEBOT_SIMULATION_SOURCE_INVALID')
        }
        hypotheticalPool = simulateMemePool(input.paperPoolScenario)
      }
    }
  }
  const disposition: MemeBotPaperReview['disposition'] =
    !draftReview ? 'DEFER'
      : draftReview.decision === 'blocked' ? 'BLOCK' : 'PAPER_PREVIEW_ONLY'

  return Object.freeze({
    schema: 'SHARK-MEMEBOT-PAPER-03' as const,
    specialist: 'MEME_BOT' as const,
    conceptId: input.conceptId,
    caseId: validated.caseId,
    receiptIdentity: validated.receiptIdentity + ':memebot:' + input.conceptId,
    comparativeResearchMint: validated.source.tokenMint,
    proposedTokenAddress: null,
    asOf: validated.asOf,
    disposition,
    draftReview,
    hypotheticalPool,
    reasons: Object.freeze([...new Set(reasons)]),
    sourceEvidenceIds: validated.source.evidenceIds,
    sourceEventDigest: validated.source.eventDigest,
    rightsIndependentlyVerified: false as const,
    legalReviewCompleted: false as const,
    realRevenueUsd: 0 as const,
    actualLaunchedTokens: 0 as const,
    disclosureOrPaperStudyIsLaunchApproval: false as const,
    authority: SHARK_BOTS_PAPER_AUTHORITY,
  })
}

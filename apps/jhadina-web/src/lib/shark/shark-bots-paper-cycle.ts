/**
 * SHARK-BOTS.PAPER.04 — one deterministic source-bound review for SniperBot
 * and MemeBot. Existing SHARK risk and Meme Venture logic make decisions;
 * this layer supplies no independent risk score and no executor.
 *
 * Paper outcome learning stays UNSCORED until a genuine later observation
 * and canonical Money/Shadow provenance checks (not asserted here).
 */
import {
  validateSharkBotPaperContext,
  type SharkBotPaperContext,
  SHARK_BOTS_PAPER_AUTHORITY,
} from './bots-paper-context'
import {
  buildSniperBotPaperReview,
  type SniperBotPaperInput,
  type SniperBotPaperReview,
} from './sniper-bot-paper-review'
import {
  buildMemeBotPaperReview,
  type MemeBotPaperInput,
  type MemeBotPaperReview,
} from './memebot-paper-review'

export type SharkBotsPaperCycle = Readonly<{
  schema: 'SHARK-BOTS-PAPER-CYCLE-04'
  receiptId: string
  caseId: string
  asOf: string
  sourceEventDigest: string
  sourceEvidenceIds: readonly string[]
  independentSourceVerified: false
  sniper: SniperBotPaperReview
  memebot: MemeBotPaperReview
  overallDisposition: 'REVIEW_PAPER_ONLY' | 'ABSTAIN'
  actualTradeCount: 0
  actualTokenLaunchCount: 0
  actualRevenueUsd: 0
  outcomeStatus: 'PENDING_GENUINE_LATER_EVIDENCE'
  shadowLessonApplied: false
  actionOrMoneyPermit: null
  authority: typeof SHARK_BOTS_PAPER_AUTHORITY
}>

export function buildSharkBotsPaperCycle(input: Readonly<{
  context: SharkBotPaperContext
  sniper?: SniperBotPaperInput
  memebot: MemeBotPaperInput
}>): SharkBotsPaperCycle {
  const validated = validateSharkBotPaperContext(input.context)
  const sniper = buildSniperBotPaperReview(input.context, input.sniper)
  const memebot = buildMemeBotPaperReview(input.context, input.memebot)
  if (sniper.caseId !== memebot.caseId || sniper.asOf !== memebot.asOf ||
      sniper.tokenMint !== memebot.comparativeResearchMint ||
      sniper.authority.canTrade !== false || memebot.authority.canLaunch !== false) {
    throw new Error('SHARK_BOTS_PAPER_SPECIALIST_LINEAGE_MISMATCH')
  }
  // A specialist's explicit BLOCK must veto any combined 'review' summary.
  // The other specialist's separate paper preview remains visible for study.
  const mayReviewPaper = sniper.disposition !== 'BLOCK' &&
    memebot.disposition !== 'BLOCK' &&
    (sniper.disposition === 'WATCH_PAPER' || memebot.disposition === 'PAPER_PREVIEW_ONLY')
  return Object.freeze({
    schema: 'SHARK-BOTS-PAPER-CYCLE-04' as const,
    receiptId: validated.receiptIdentity + ':' + memebot.conceptId,
    caseId: validated.caseId,
    asOf: validated.asOf,
    sourceEventDigest: validated.source.eventDigest,
    sourceEvidenceIds: validated.source.evidenceIds,
    independentSourceVerified: false as const,
    sniper,
    memebot,
    overallDisposition: mayReviewPaper ? 'REVIEW_PAPER_ONLY' as const : 'ABSTAIN' as const,
    actualTradeCount: 0 as const,
    actualTokenLaunchCount: 0 as const,
    actualRevenueUsd: 0 as const,
    outcomeStatus: 'PENDING_GENUINE_LATER_EVIDENCE' as const,
    shadowLessonApplied: false as const,
    actionOrMoneyPermit: null,
    authority: SHARK_BOTS_PAPER_AUTHORITY,
  })
}

/**
 * SHARK-ATTENTION.04: only a negative-evidence overlay on the existing
 * SHARK position re-underwriter. No second position manager or order path.
 */
import {assessPublicAttention} from './attention-research'
import type {AttentionResearchReport} from './attention-research'
import {reviewMemePosition} from './position-review'
import type {MemePositionReview,MemePositionReviewState} from './position-review'

export type AttentionPositionReview=Readonly<{
  report:AttentionResearchReport
  positionReview:MemePositionReview
  riskOverlay:'NEGATIVE_EVIDENCE_ONLY'
  authority:'RESEARCH_ONLY'
  canExecute:false
}>

export function reviewPositionWithPublicAttention(input:Readonly<{
  position:MemePositionReviewState
  attention:Parameters<typeof assessPublicAttention>[0]
  reviewConfig?:Parameters<typeof reviewMemePosition>[1]
}>):AttentionPositionReview{
  const report=assessPublicAttention(input.attention)
  // Add no bullish thesis confidence. Only preserve or raise risk based on
  // source-labeled public observations. No retraction automatically certifies
  // a thesis as false; existing governed thesis-invalidation input remains.
  const positionReview=reviewMemePosition({
    ...input.position,
    narrativeDegradationScore:Math.max(input.position.narrativeDegradationScore??0,
      report.riskSignals.narrativeDegradationScore),
    whaleDistributionScore:Math.max(input.position.whaleDistributionScore??0,
      report.riskSignals.whaleDistributionScore),
    smartWalletExitScore:Math.max(input.position.smartWalletExitScore??0,
      report.riskSignals.smartWalletExitScore),
  },input.reviewConfig)
  return Object.freeze({
    report,positionReview,riskOverlay:'NEGATIVE_EVIDENCE_ONLY' as const,
    authority:'RESEARCH_ONLY' as const,canExecute:false as const,
  })
}

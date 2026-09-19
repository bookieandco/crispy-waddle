import type { PaperFill, PaperPosition, PaperTradeProposal } from './paper-trade-contracts'
import type { PaperExit, PaperMark } from './paper-execution'

export type PaperTradeOutcomeLabel = 'WIN' | 'LOSS' | 'BREAKEVEN' | 'OPEN' | 'INVALID'

export type PaperTradeOutcome = Readonly<{
  outcomeId: string
  simulationAuthority: 'PAPER_ONLY'
  paperTradeProposalId: string
  assessmentId: string
  decisionProposalId: string
  chainId: string
  tokenAddress: string
  evaluatedAt: string
  label: PaperTradeOutcomeLabel
  realizedPnlQuote: number
  realizedRoi: number
  remainingQuantity: number
  totalFeesQuote: number
  totalSlippageQuote: number
  maxFavorableExcursion: number
  maxAdverseExcursion: number
  evidenceIds: readonly string[]
}>

export type TradeAttribution = Readonly<{
  attributionId: string
  simulationAuthority: 'PAPER_ONLY'
  outcomeId: string
  paperTradeProposalId: string
  assessmentId: string
  decisionProposalId: string
  positiveDrivers: readonly string[]
  negativeDrivers: readonly string[]
  exitReasons: readonly string[]
  feeDragQuote: number
  slippageDragQuote: number
  marketMoveContributionQuote: number
  residualQuote: number
  evidenceIds: readonly string[]
  attributedAt: string
}>

const finite = (value: number, field: string): void => {
  if (!Number.isFinite(value)) throw new Error(`paper_outcome_invalid_${field}`)
}

export function evaluatePaperTradeOutcome(input: {
  proposal: PaperTradeProposal
  position: PaperPosition
  fills: readonly PaperFill[]
  marks: readonly PaperMark[]
  evaluatedAt: string
  evidenceIds?: readonly string[]
}): PaperTradeOutcome {
  if (input.position.paperTradeProposalId !== input.proposal.proposalId) throw new Error('paper_outcome_lineage_mismatch')
  if (!input.evaluatedAt) throw new Error('paper_outcome_timestamp_required')
  const entryFill = input.fills.find(fill => fill.orderId.includes('paper-order:entry:'))
  if (!entryFill) throw new Error('paper_outcome_entry_fill_required')

  const exitFills = input.fills.filter(fill => fill.orderId.includes('paper-order:exit:'))
  const totalFeesQuote = input.fills.reduce((sum, fill) => sum + fill.feeQuoteAmount, 0)
  const entryReference = input.proposal.entryPrice
  const totalSlippageQuote = input.fills.reduce((sum, fill) => {
    const reference = fill === entryFill ? entryReference : fill.price / Math.max(Number.EPSILON, 1 - fill.slippageBps / 10_000)
    return sum + Math.abs(fill.price - reference) * fill.quantity
  }, 0)

  const basisRealized = exitFills.reduce((sum, fill) => {
    const entryUnitCost = entryFill.grossQuoteAmount / entryFill.quantity
    return sum + entryUnitCost * fill.quantity
  }, 0)
  const realizedRoi = basisRealized > 0 ? input.position.realizedPnlQuote / basisRealized : 0
  const markRois = input.marks.map(mark => mark.unrealizedRoi)
  const maxFavorableExcursion = markRois.length ? Math.max(0, ...markRois) : 0
  const maxAdverseExcursion = markRois.length ? Math.min(0, ...markRois) : 0

  let label: PaperTradeOutcomeLabel = input.position.status === 'OPEN' ? 'OPEN' : 'BREAKEVEN'
  if (input.position.status === 'CLOSED') {
    if (input.position.realizedPnlQuote > 0) label = 'WIN'
    else if (input.position.realizedPnlQuote < 0) label = 'LOSS'
  }
  finite(realizedRoi, 'realized_roi')

  const evidence = new Set(input.evidenceIds ?? [])
  input.proposal.provenance.evidenceIds.forEach(id => evidence.add(id))
  input.fills.forEach(fill => evidence.add(fill.marketObservationId))
  input.marks.forEach(mark => evidence.add(mark.marketObservationId))

  return Object.freeze({
    outcomeId: `paper-outcome:${input.proposal.proposalId}`,
    simulationAuthority: 'PAPER_ONLY' as const,
    paperTradeProposalId: input.proposal.proposalId,
    assessmentId: input.proposal.provenance.assessmentId,
    decisionProposalId: input.proposal.provenance.decisionProposalId,
    chainId: input.proposal.chainId,
    tokenAddress: input.proposal.tokenAddress,
    evaluatedAt: input.evaluatedAt,
    label,
    realizedPnlQuote: input.position.realizedPnlQuote,
    realizedRoi,
    remainingQuantity: input.position.quantity,
    totalFeesQuote,
    totalSlippageQuote,
    maxFavorableExcursion,
    maxAdverseExcursion,
    evidenceIds: Object.freeze([...evidence]),
  })
}

export function attributePaperTrade(input: {
  outcome: PaperTradeOutcome
  proposal: PaperTradeProposal
  entryFill: PaperFill
  exitFills: readonly PaperFill[]
  exits: readonly PaperExit[]
  attributedAt: string
}): TradeAttribution {
  if (input.outcome.paperTradeProposalId !== input.proposal.proposalId) throw new Error('trade_attribution_lineage_mismatch')
  const positiveDrivers: string[] = []
  const negativeDrivers: string[] = []
  if (input.outcome.realizedPnlQuote > 0) positiveDrivers.push('realized-paper-profit')
  if (input.outcome.maxFavorableExcursion > 0) positiveDrivers.push('favorable-market-excursion')
  if (input.outcome.realizedPnlQuote < 0) negativeDrivers.push('realized-paper-loss')
  if (input.outcome.maxAdverseExcursion < 0) negativeDrivers.push('adverse-market-excursion')
  if (input.outcome.totalFeesQuote > 0) negativeDrivers.push('fee-drag')
  if (input.outcome.totalSlippageQuote > 0) negativeDrivers.push('slippage-drag')

  const exitedQuantity = input.exitFills.reduce((sum, fill) => sum + fill.quantity, 0)
  const entryReference = input.proposal.entryPrice
  const referenceExitGross = input.exitFills.reduce((sum, fill) => {
    const referencePrice = fill.price / Math.max(Number.EPSILON, 1 - fill.slippageBps / 10_000)
    return sum + referencePrice * fill.quantity
  }, 0)
  // Attribution is expressed against market reference prices so execution slippage
  // is a separate drag rather than being hidden inside market movement.
  const marketMoveContributionQuote = referenceExitGross - entryReference * exitedQuantity
  const feeDragQuote = input.outcome.totalFeesQuote
  const slippageDragQuote = input.outcome.totalSlippageQuote
  const explained = marketMoveContributionQuote - feeDragQuote - slippageDragQuote
  const residualQuote = input.outcome.realizedPnlQuote - explained

  const evidence = new Set(input.outcome.evidenceIds)
  const exitReasons = [...new Set(input.exits.flatMap(exit => exit.reasons))]
  return Object.freeze({
    attributionId: `trade-attribution:${input.outcome.outcomeId}`,
    simulationAuthority: 'PAPER_ONLY' as const,
    outcomeId: input.outcome.outcomeId,
    paperTradeProposalId: input.proposal.proposalId,
    assessmentId: input.outcome.assessmentId,
    decisionProposalId: input.outcome.decisionProposalId,
    positiveDrivers: Object.freeze(positiveDrivers),
    negativeDrivers: Object.freeze(negativeDrivers),
    exitReasons: Object.freeze(exitReasons),
    feeDragQuote,
    slippageDragQuote,
    marketMoveContributionQuote,
    residualQuote,
    evidenceIds: Object.freeze([...evidence]),
    attributedAt: input.attributedAt,
  })
}

/**
 * LaunchOutcome describes what happened to a token/developer launch.
 * PaperTradeOutcome describes what happened to SHARK's simulated strategy.
 * They intentionally have no conversion function: one must never stand in for the other.
 */
export const PAPER_TRADE_OUTCOME_IS_DISTINCT_FROM_LAUNCH_OUTCOME = true as const

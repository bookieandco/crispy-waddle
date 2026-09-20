import {
  createPaperFill,
  createPaperOrder,
  createPaperPosition,
  type PaperFill,
  type PaperOrder,
  type PaperPosition,
  type PaperTradeProposal,
} from './paper-trade-contracts'
import { planProfitTaking, type ProfitTakingState } from './profit-taking'

export type PaperMarketObservation = Readonly<{
  observationId: string
  observedAt: string
  chainId: string
  tokenAddress: string
  price: number
  liquidityQuote?: number
}>

export type PaperMark = Readonly<{
  markId: string
  positionId: string
  simulationAuthority: 'PAPER_ONLY'
  marketObservationId: string
  markedAt: string
  price: number
  quantity: number
  marketValueQuote: number
  unrealizedPnlQuote: number
  unrealizedRoi: number
}>

export type PaperExit = Readonly<{
  exitId: string
  positionId: string
  simulationAuthority: 'PAPER_ONLY'
  marketObservationId: string
  proposedAt: string
  quantity: number
  fractionOfPosition: number
  referencePrice: number
  reasons: readonly string[]
}>

const positive = (value: number, field: string) => {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`paper_execution_invalid_${field}`)
}
const nonNegative = (value: number, field: string) => {
  if (!Number.isFinite(value) || value < 0) throw new Error(`paper_execution_invalid_${field}`)
}

function assertObservation(
  chainId: string,
  tokenAddress: string,
  observation: PaperMarketObservation,
): void {
  if (observation.chainId !== chainId || observation.tokenAddress !== tokenAddress) {
    throw new Error('paper_execution_market_identity_mismatch')
  }
  if (!observation.observationId || !observation.observedAt) throw new Error('paper_execution_observation_required')
  positive(observation.price, 'market_price')
}

export function simulatePaperEntry(
  proposal: PaperTradeProposal,
  observation: PaperMarketObservation,
): Readonly<{ order: PaperOrder; fill: PaperFill; position: PaperPosition }> {
  assertObservation(proposal.chainId, proposal.tokenAddress, observation)
  const slippage = proposal.assumptions.slippageBps / 10_000
  const feeRate = proposal.assumptions.feeBps / 10_000
  const fillPrice = observation.price * (1 + slippage)
  const quantity = proposal.simulatedCapital / (fillPrice * (1 + feeRate))
  positive(quantity, 'entry_quantity')
  const gross = quantity * fillPrice
  const fee = gross * feeRate

  const order = createPaperOrder({
    orderId: `paper-order:entry:${proposal.proposalId}`,
    paperTradeProposalId: proposal.proposalId,
    chainId: proposal.chainId,
    tokenAddress: proposal.tokenAddress,
    side: 'BUY',
    quantity,
    referencePrice: observation.price,
    createdAt: observation.observedAt,
    status: 'FILLED',
  })
  const fill = createPaperFill({
    fillId: `paper-fill:entry:${proposal.proposalId}:${observation.observationId}`,
    orderId: order.orderId,
    quantity,
    price: fillPrice,
    grossQuoteAmount: gross,
    feeQuoteAmount: fee,
    slippageBps: proposal.assumptions.slippageBps,
    filledAt: observation.observedAt,
    marketObservationId: observation.observationId,
  })
  const position = createPaperPosition({
    positionId: `paper-position:${proposal.proposalId}`,
    paperTradeProposalId: proposal.proposalId,
    chainId: proposal.chainId,
    tokenAddress: proposal.tokenAddress,
    quoteAsset: proposal.quoteAsset,
    openedAt: observation.observedAt,
    status: 'OPEN',
    quantity,
    averageEntryPrice: fillPrice,
    costBasisQuote: gross + fee,
    realizedPnlQuote: 0,
    fillIds: [fill.fillId],
  })
  return Object.freeze({ order, fill, position })
}

export function markPaperPosition(
  position: PaperPosition,
  observation: PaperMarketObservation,
): PaperMark {
  assertObservation(position.chainId, position.tokenAddress, observation)
  const marketValueQuote = position.quantity * observation.price
  const unrealizedPnlQuote = marketValueQuote - position.costBasisQuote
  const unrealizedRoi = position.costBasisQuote > 0 ? unrealizedPnlQuote / position.costBasisQuote : 0
  return Object.freeze({
    markId: `paper-mark:${position.positionId}:${observation.observationId}`,
    positionId: position.positionId,
    simulationAuthority: 'PAPER_ONLY' as const,
    marketObservationId: observation.observationId,
    markedAt: observation.observedAt,
    price: observation.price,
    quantity: position.quantity,
    marketValueQuote,
    unrealizedPnlQuote,
    unrealizedRoi,
  })
}

export function proposePaperExit(
  position: PaperPosition,
  observation: PaperMarketObservation,
  state: Omit<ProfitTakingState, 'entryPrice' | 'currentPrice'>,
): PaperExit | undefined {
  if (position.status !== 'OPEN' || position.quantity <= 0) return undefined
  assertObservation(position.chainId, position.tokenAddress, observation)
  const plan = planProfitTaking({
    ...state,
    entryPrice: position.averageEntryPrice,
    currentPrice: observation.price,
  })
  const fraction = Math.max(0, Math.min(1, 1 - plan.remainingPositionFraction))
  if (fraction <= 0) return undefined
  const quantity = position.quantity * fraction
  positive(quantity, 'exit_quantity')
  return Object.freeze({
    exitId: `paper-exit:${position.positionId}:${observation.observationId}`,
    positionId: position.positionId,
    simulationAuthority: 'PAPER_ONLY' as const,
    marketObservationId: observation.observationId,
    proposedAt: observation.observedAt,
    quantity,
    fractionOfPosition: fraction,
    referencePrice: observation.price,
    reasons: Object.freeze([...plan.reasons]),
  })
}

export function simulatePaperExitFill(
  proposal: PaperTradeProposal,
  position: PaperPosition,
  exit: PaperExit,
  observation: PaperMarketObservation,
): Readonly<{ order: PaperOrder; fill: PaperFill; position: PaperPosition }> {
  if (exit.positionId !== position.positionId || exit.marketObservationId !== observation.observationId) {
    throw new Error('paper_exit_lineage_mismatch')
  }
  assertObservation(position.chainId, position.tokenAddress, observation)
  positive(exit.quantity, 'exit_quantity')
  if (exit.quantity > position.quantity) throw new Error('paper_exit_quantity_exceeds_position')

  const slippage = proposal.assumptions.slippageBps / 10_000
  const feeRate = proposal.assumptions.feeBps / 10_000
  const fillPrice = observation.price * (1 - slippage)
  const gross = exit.quantity * fillPrice
  const fee = gross * feeRate
  const costReleased = position.costBasisQuote * (exit.quantity / position.quantity)
  const realized = gross - fee - costReleased
  nonNegative(gross, 'exit_gross')

  const order = createPaperOrder({
    orderId: `paper-order:exit:${exit.exitId}`,
    paperTradeProposalId: proposal.proposalId,
    chainId: position.chainId,
    tokenAddress: position.tokenAddress,
    side: 'SELL',
    quantity: exit.quantity,
    referencePrice: observation.price,
    createdAt: exit.proposedAt,
    status: 'FILLED',
  })
  const fill = createPaperFill({
    fillId: `paper-fill:exit:${exit.exitId}`,
    orderId: order.orderId,
    quantity: exit.quantity,
    price: fillPrice,
    grossQuoteAmount: gross,
    feeQuoteAmount: fee,
    slippageBps: proposal.assumptions.slippageBps,
    filledAt: observation.observedAt,
    marketObservationId: observation.observationId,
  })
  const remaining = position.quantity - exit.quantity
  const nextPosition = createPaperPosition({
    positionId: position.positionId,
    paperTradeProposalId: position.paperTradeProposalId,
    chainId: position.chainId,
    tokenAddress: position.tokenAddress,
    quoteAsset: position.quoteAsset,
    openedAt: position.openedAt,
    status: remaining <= Number.EPSILON ? 'CLOSED' : 'OPEN',
    quantity: Math.max(0, remaining),
    averageEntryPrice: position.averageEntryPrice,
    costBasisQuote: Math.max(0, position.costBasisQuote - costReleased),
    realizedPnlQuote: position.realizedPnlQuote + realized,
    fillIds: [...position.fillIds, fill.fillId],
  })
  return Object.freeze({ order, fill, position: nextPosition })
}

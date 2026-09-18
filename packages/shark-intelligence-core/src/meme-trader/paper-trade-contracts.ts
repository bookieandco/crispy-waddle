/**
 * SHARK paper-trading contracts.
 *
 * These records model hypothetical execution only. They grant no wallet,
 * signing, RPC submission, brokerage, or live-capital authority.
 */
export type PaperTradeSide = 'BUY' | 'SELL'
export type PaperOrderStatus = 'PROPOSED' | 'FILLED' | 'PARTIALLY_FILLED' | 'CANCELLED'
export type PaperPositionStatus = 'OPEN' | 'CLOSED'

export type PaperTradeProvenance = Readonly<{
  assessmentId: string
  decisionProposalId: string
  evidenceIds: readonly string[]
}>

export type PaperExecutionAssumptions = Readonly<{
  feeBps: number
  slippageBps: number
  latencyMs?: number
}>

export type PaperTradeProposal = Readonly<{
  proposalId: string
  simulationAuthority: 'PAPER_ONLY'
  chainId: string
  tokenAddress: string
  quoteAsset: string
  proposedAt: string
  simulatedCapital: number
  entryPrice: number
  assumptions: PaperExecutionAssumptions
  provenance: PaperTradeProvenance
}>

export type PaperOrder = Readonly<{
  orderId: string
  paperTradeProposalId: string
  simulationAuthority: 'PAPER_ONLY'
  chainId: string
  tokenAddress: string
  side: PaperTradeSide
  quantity: number
  referencePrice: number
  createdAt: string
  status: PaperOrderStatus
}>

export type PaperFill = Readonly<{
  fillId: string
  orderId: string
  simulationAuthority: 'PAPER_ONLY'
  quantity: number
  price: number
  grossQuoteAmount: number
  feeQuoteAmount: number
  slippageBps: number
  filledAt: string
  marketObservationId: string
}>

export type PaperPosition = Readonly<{
  positionId: string
  paperTradeProposalId: string
  simulationAuthority: 'PAPER_ONLY'
  chainId: string
  tokenAddress: string
  quoteAsset: string
  openedAt: string
  status: PaperPositionStatus
  quantity: number
  averageEntryPrice: number
  costBasisQuote: number
  realizedPnlQuote: number
  fillIds: readonly string[]
}>

export type PaperPortfolio = Readonly<{
  portfolioId: string
  simulationAuthority: 'PAPER_ONLY'
  quoteAsset: string
  initialCapital: number
  cashBalance: number
  positionIds: readonly string[]
  updatedAt: string
}>

function positive(value: number, field: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`paper_trade_invalid_${field}`)
}

function nonNegative(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0) throw new Error(`paper_trade_invalid_${field}`)
}

export function createPaperTradeProposal(input: Omit<PaperTradeProposal, 'simulationAuthority'>): PaperTradeProposal {
  if (!input.proposalId || !input.chainId || !input.tokenAddress || !input.quoteAsset) throw new Error('paper_trade_identity_required')
  if (!input.provenance.assessmentId || !input.provenance.decisionProposalId) throw new Error('paper_trade_lineage_required')
  positive(input.simulatedCapital, 'capital')
  positive(input.entryPrice, 'entry_price')
  nonNegative(input.assumptions.feeBps, 'fee_bps')
  nonNegative(input.assumptions.slippageBps, 'slippage_bps')
  return Object.freeze({
    ...input,
    assumptions: Object.freeze({ ...input.assumptions }),
    provenance: Object.freeze({ ...input.provenance, evidenceIds: Object.freeze([...input.provenance.evidenceIds]) }),
    simulationAuthority: 'PAPER_ONLY' as const,
  })
}

export function createPaperOrder(input: Omit<PaperOrder, 'simulationAuthority'>): PaperOrder {
  if (!input.orderId || !input.paperTradeProposalId || !input.chainId || !input.tokenAddress) throw new Error('paper_order_identity_required')
  positive(input.quantity, 'quantity')
  positive(input.referencePrice, 'reference_price')
  return Object.freeze({ ...input, simulationAuthority: 'PAPER_ONLY' as const })
}

export function createPaperFill(input: Omit<PaperFill, 'simulationAuthority'>): PaperFill {
  if (!input.fillId || !input.orderId || !input.marketObservationId) throw new Error('paper_fill_lineage_required')
  positive(input.quantity, 'fill_quantity')
  positive(input.price, 'fill_price')
  nonNegative(input.grossQuoteAmount, 'gross_quote_amount')
  nonNegative(input.feeQuoteAmount, 'fee_quote_amount')
  nonNegative(input.slippageBps, 'fill_slippage_bps')
  return Object.freeze({ ...input, simulationAuthority: 'PAPER_ONLY' as const })
}

export function createPaperPosition(input: Omit<PaperPosition, 'simulationAuthority'>): PaperPosition {
  if (!input.positionId || !input.paperTradeProposalId || !input.chainId || !input.tokenAddress || !input.quoteAsset) throw new Error('paper_position_identity_required')
  nonNegative(input.quantity, 'position_quantity')
  positive(input.averageEntryPrice, 'average_entry_price')
  nonNegative(input.costBasisQuote, 'cost_basis')
  return Object.freeze({ ...input, fillIds: Object.freeze([...input.fillIds]), simulationAuthority: 'PAPER_ONLY' as const })
}

export function createPaperPortfolio(input: Omit<PaperPortfolio, 'simulationAuthority'>): PaperPortfolio {
  if (!input.portfolioId || !input.quoteAsset) throw new Error('paper_portfolio_identity_required')
  nonNegative(input.initialCapital, 'initial_capital')
  nonNegative(input.cashBalance, 'cash_balance')
  return Object.freeze({ ...input, positionIds: Object.freeze([...input.positionIds]), simulationAuthority: 'PAPER_ONLY' as const })
}

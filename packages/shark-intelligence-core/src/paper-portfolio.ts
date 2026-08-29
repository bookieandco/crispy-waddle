export type SharkPaperPortfolioPosition = {
  opportunityId: string
  quantity: number
  averageEntryPrice: number
  realizedPnl: number
  unrealizedPnl: number
  marketValue: number
}

export type SharkPaperPortfolio = {
  currency: string
  availableCash: number
  reservedCash: number
  positions: SharkPaperPortfolioPosition[]
  equity: number
  realizedPnl: number
  unrealizedPnl: number
  simulated: true
}

export function calculateSharkPaperPortfolio(input: {
  currency: string
  availableCash: number
  reservedCash: number
  positions: SharkPaperPortfolioPosition[]
}): SharkPaperPortfolio {
  if (!input.currency) throw new Error('portfolio currency is required')
  if (!Number.isFinite(input.availableCash) || input.availableCash < 0) throw new Error('available cash must be non-negative')
  if (!Number.isFinite(input.reservedCash) || input.reservedCash < 0) throw new Error('reserved cash must be non-negative')

  const ids = new Set<string>()
  let marketValue = 0
  let realizedPnl = 0
  let unrealizedPnl = 0

  for (const position of input.positions) {
    if (!position.opportunityId) throw new Error('position opportunity id is required')
    if (ids.has(position.opportunityId)) throw new Error('duplicate paper portfolio position')
    ids.add(position.opportunityId)
    if (!Number.isFinite(position.quantity) || position.quantity < 0) throw new Error('position quantity must be non-negative')
    if (!Number.isFinite(position.marketValue) || position.marketValue < 0) throw new Error('position market value must be non-negative')
    if (!Number.isFinite(position.realizedPnl)) throw new Error('position realized P&L must be finite')
    if (!Number.isFinite(position.unrealizedPnl)) throw new Error('position unrealized P&L must be finite')
    marketValue += position.marketValue
    realizedPnl += position.realizedPnl
    unrealizedPnl += position.unrealizedPnl
  }

  return {
    currency: input.currency,
    availableCash: input.availableCash,
    reservedCash: input.reservedCash,
    positions: input.positions,
    equity: input.availableCash + input.reservedCash + marketValue,
    realizedPnl,
    unrealizedPnl,
    simulated: true,
  }
}

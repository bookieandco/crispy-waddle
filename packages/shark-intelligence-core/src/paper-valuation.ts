export type SharkPaperPositionMark = {
  quantity: number
  averageEntryPrice: number
  realizedPnl: number
}

export type SharkPaperValuation = {
  markPrice: number
  marketValue: number
  unrealizedPnl: number
  realizedPnl: number
  totalPnl: number
  valuedAt: string
  simulated: true
}

export function markSharkPaperPosition(input: {
  position: SharkPaperPositionMark
  markPrice: number
  valuedAt: string
}): SharkPaperValuation {
  const { position, markPrice, valuedAt } = input
  if (!Number.isFinite(position.quantity) || position.quantity < 0) throw new Error('position quantity must be non-negative')
  if (!Number.isFinite(position.averageEntryPrice) || position.averageEntryPrice < 0) throw new Error('average entry price must be non-negative')
  if (!Number.isFinite(position.realizedPnl)) throw new Error('realized P&L must be finite')
  if (!Number.isFinite(markPrice) || markPrice <= 0) throw new Error('mark price must be greater than 0')
  if (!valuedAt) throw new Error('valuation timestamp is required')

  const marketValue = position.quantity * markPrice
  const unrealizedPnl = position.quantity * (markPrice - position.averageEntryPrice)

  return {
    markPrice,
    marketValue,
    unrealizedPnl,
    realizedPnl: position.realizedPnl,
    totalPnl: position.realizedPnl + unrealizedPnl,
    valuedAt,
    simulated: true,
  }
}

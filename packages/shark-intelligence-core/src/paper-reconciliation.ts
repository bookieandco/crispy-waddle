export type SharkPaperReconciliation = {
  expectedEquity: number
  reportedEquity: number
  equityDelta: number
  expectedPosition: number
  reportedPosition: number
  positionDelta: number
  expectedRealizedPnl: number
  reportedRealizedPnl: number
  realizedPnlDelta: number
  reconciled: boolean
  simulated: true
}

export function reconcileSharkPaperState(input: {
  cash: number
  marketValue: number
  expectedPosition: number
  expectedRealizedPnl: number
  reportedEquity: number
  reportedPosition: number
  reportedRealizedPnl: number
  tolerance?: number
}): SharkPaperReconciliation {
  const tolerance = input.tolerance ?? 0.000001
  if (!Number.isFinite(tolerance) || tolerance < 0) throw new Error('reconciliation tolerance must be non-negative')
  for (const value of [input.cash, input.marketValue, input.expectedPosition, input.expectedRealizedPnl, input.reportedEquity, input.reportedPosition, input.reportedRealizedPnl]) {
    if (!Number.isFinite(value)) throw new Error('reconciliation values must be finite')
  }

  const expectedEquity = input.cash + input.marketValue
  const equityDelta = input.reportedEquity - expectedEquity
  const positionDelta = input.reportedPosition - input.expectedPosition
  const realizedPnlDelta = input.reportedRealizedPnl - input.expectedRealizedPnl
  const reconciled = Math.abs(equityDelta) <= tolerance && Math.abs(positionDelta) <= tolerance && Math.abs(realizedPnlDelta) <= tolerance

  return {
    expectedEquity,
    reportedEquity: input.reportedEquity,
    equityDelta,
    expectedPosition: input.expectedPosition,
    reportedPosition: input.reportedPosition,
    positionDelta,
    expectedRealizedPnl: input.expectedRealizedPnl,
    reportedRealizedPnl: input.reportedRealizedPnl,
    realizedPnlDelta,
    reconciled,
    simulated: true,
  }
}

export type SharkPaperRiskPosition = {
  id: string
  marketValue: number
}

export type SharkPaperRiskAssessment = {
  equity: number
  grossExposure: number
  peakEquity: number
  drawdown: number
  drawdownPct: number
  concentrationPct: number
  maxDrawdownPct: number
  maxConcentrationPct: number
  withinLimits: boolean
  disposition: 'within_limit' | 'risk_limit_breached'
  simulated: true
}

export function assessSharkPaperRisk(input: {
  equity: number
  peakEquity: number
  positions: SharkPaperRiskPosition[]
  maxDrawdownPct: number
  maxConcentrationPct: number
}): SharkPaperRiskAssessment {
  if (!Number.isFinite(input.equity) || input.equity <= 0) throw new Error('equity must be greater than 0')
  if (!Number.isFinite(input.peakEquity) || input.peakEquity <= 0) throw new Error('peak equity must be greater than 0')
  if (input.peakEquity < input.equity) {
    // valid drawdown state
  }
  if (!Number.isFinite(input.maxDrawdownPct) || input.maxDrawdownPct < 0) throw new Error('max drawdown limit must be non-negative')
  if (!Number.isFinite(input.maxConcentrationPct) || input.maxConcentrationPct < 0) throw new Error('max concentration limit must be non-negative')

  let grossExposure = 0
  let largestPosition = 0
  const ids = new Set<string>()
  for (const position of input.positions) {
    if (!position.id) throw new Error('risk position id is required')
    if (ids.has(position.id)) throw new Error('duplicate risk position id')
    ids.add(position.id)
    if (!Number.isFinite(position.marketValue) || position.marketValue < 0) throw new Error('position market value must be non-negative')
    grossExposure += position.marketValue
    largestPosition = Math.max(largestPosition, position.marketValue)
  }

  const drawdown = Math.max(0, input.peakEquity - input.equity)
  const drawdownPct = drawdown / input.peakEquity * 100
  const concentrationPct = largestPosition / input.equity * 100
  const withinLimits = drawdownPct <= input.maxDrawdownPct && concentrationPct <= input.maxConcentrationPct

  return {
    equity: input.equity,
    grossExposure,
    peakEquity: input.peakEquity,
    drawdown,
    drawdownPct,
    concentrationPct,
    maxDrawdownPct: input.maxDrawdownPct,
    maxConcentrationPct: input.maxConcentrationPct,
    withinLimits,
    disposition: withinLimits ? 'within_limit' : 'risk_limit_breached',
    simulated: true,
  }
}

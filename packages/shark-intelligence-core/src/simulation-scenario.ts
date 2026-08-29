export type SharkPricePoint = {
  at: string
  price: number
}

export type SharkSimulationScenario = {
  id: string
  seed: string
  symbol: string
  pricePath: SharkPricePoint[]
  slippageBps: number
  feeBps: number
  simulated: true
}

export function createSharkSimulationScenario(input: {
  id: string
  seed: string
  symbol: string
  pricePath: SharkPricePoint[]
  slippageBps?: number
  feeBps?: number
}): SharkSimulationScenario {
  if (!input.id) throw new Error('scenario id is required')
  if (!input.seed) throw new Error('scenario seed is required')
  if (!input.symbol) throw new Error('scenario symbol is required')
  if (input.pricePath.length === 0) throw new Error('scenario price path is required')

  let previousAt: string | undefined
  for (const point of input.pricePath) {
    if (!point.at) throw new Error('scenario price timestamp is required')
    if (previousAt && point.at < previousAt) throw new Error('scenario price path must be ordered')
    if (!Number.isFinite(point.price) || point.price <= 0) throw new Error('scenario price must be greater than 0')
    previousAt = point.at
  }

  const slippageBps = input.slippageBps ?? 0
  const feeBps = input.feeBps ?? 0
  if (!Number.isFinite(slippageBps) || slippageBps < 0) throw new Error('scenario slippage must be non-negative')
  if (!Number.isFinite(feeBps) || feeBps < 0) throw new Error('scenario fee must be non-negative')

  return { ...input, slippageBps, feeBps, simulated: true }
}

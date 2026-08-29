import { sellSharkPaperLots, type SharkPaperLot } from './paper-cost-basis'

export type SharkBacktestPoint = { at: string; price: number }
export type SharkBacktestDecision = { at: string; action: 'buy' | 'sell' | 'hold'; quantity: number }
export type SharkBacktestResult = { startingCash: number; endingCash: number; position: number; trades: number; realizedPnl: number; simulated: true }

export function runSharkBacktest(input: {
  startingCash: number
  prices: SharkBacktestPoint[]
  decisions: SharkBacktestDecision[]
  feeBps?: number
}): SharkBacktestResult {
  if (!Number.isFinite(input.startingCash) || input.startingCash < 0) throw new Error('starting cash must be non-negative')
  if (input.prices.length === 0) throw new Error('backtest price series is required')
  const feeBps = input.feeBps ?? 0
  if (!Number.isFinite(feeBps) || feeBps < 0) throw new Error('backtest fee must be non-negative')

  const prices = new Map(input.prices.map((point) => [point.at, point.price]))
  let cash = input.startingCash
  let realizedPnl = 0
  let trades = 0
  let lots: SharkPaperLot[] = []

  for (const decision of input.decisions) {
    const price = prices.get(decision.at)
    if (price === undefined || !Number.isFinite(price) || price <= 0) throw new Error(`missing valid price for decision at ${decision.at}`)
    if (!Number.isFinite(decision.quantity) || decision.quantity < 0) throw new Error('decision quantity must be non-negative')
    if (decision.action === 'hold' || decision.quantity === 0) continue

    const notional = decision.quantity * price
    const fee = notional * feeBps / 10000
    if (decision.action === 'buy') {
      if (cash < notional + fee) throw new Error('insufficient simulated cash')
      cash -= notional + fee
      lots.push({ quantity: decision.quantity, entryPrice: price })
    } else {
      const result = sellSharkPaperLots({ lots, quantity: decision.quantity, sellPrice: price, feeBps })
      cash += result.proceeds - result.fee
      realizedPnl += result.realizedPnl
      lots = result.remainingLots
    }
    trades += 1
  }

  return { startingCash: input.startingCash, endingCash: cash, position: lots.reduce((sum, lot) => sum + lot.quantity, 0), trades, realizedPnl, simulated: true }
}

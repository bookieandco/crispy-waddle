export type SharkPaperLot = {
  quantity: number
  entryPrice: number
}

export type SharkPaperSellResult = {
  remainingLots: SharkPaperLot[]
  proceeds: number
  fee: number
  realizedPnl: number
  soldQuantity: number
  simulated: true
}

export function sellSharkPaperLots(input: {
  lots: SharkPaperLot[]
  quantity: number
  sellPrice: number
  feeBps?: number
}): SharkPaperSellResult {
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) throw new Error('sell quantity must be greater than 0')
  if (!Number.isFinite(input.sellPrice) || input.sellPrice <= 0) throw new Error('sell price must be greater than 0')
  const feeBps = input.feeBps ?? 0
  if (!Number.isFinite(feeBps) || feeBps < 0) throw new Error('fee must be non-negative')

  let remainingToSell = input.quantity
  let realizedPnl = 0
  const remainingLots: SharkPaperLot[] = []

  for (const lot of input.lots) {
    if (!Number.isFinite(lot.quantity) || lot.quantity <= 0) throw new Error('lot quantity must be greater than 0')
    if (!Number.isFinite(lot.entryPrice) || lot.entryPrice <= 0) throw new Error('lot entry price must be greater than 0')
    if (remainingToSell === 0) {
      remainingLots.push(lot)
      continue
    }
    const sold = Math.min(lot.quantity, remainingToSell)
    realizedPnl += sold * (input.sellPrice - lot.entryPrice)
    remainingToSell -= sold
    const remainingLotQuantity = lot.quantity - sold
    if (remainingLotQuantity > 0) remainingLots.push({ ...lot, quantity: remainingLotQuantity })
  }

  if (remainingToSell > 0) throw new Error('sell quantity exceeds paper position')

  const proceeds = input.quantity * input.sellPrice
  const fee = proceeds * feeBps / 10000
  return {
    remainingLots,
    proceeds,
    fee,
    realizedPnl: realizedPnl - fee,
    soldQuantity: input.quantity,
    simulated: true,
  }
}

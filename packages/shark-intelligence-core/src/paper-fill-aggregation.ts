export type SharkPaperFillInput = {
  id: string
  quantity: number
  price: number
  fee: number
  slippage: number
  filledAt: string
}

export type SharkPaperFillAggregate = {
  quantity: number
  grossNotional: number
  fees: number
  averagePrice: number
  totalSlippage: number
}

export function aggregateSharkPaperFills(fills: SharkPaperFillInput[]): SharkPaperFillAggregate {
  if (fills.length === 0) throw new Error('at least one paper fill is required')
  const ids = new Set<string>()
  let quantity = 0
  let grossNotional = 0
  let fees = 0
  let totalSlippage = 0

  for (const fill of fills) {
    if (!fill.id) throw new Error('paper fill id is required')
    if (ids.has(fill.id)) throw new Error('duplicate paper fill id')
    ids.add(fill.id)
    if (!Number.isFinite(fill.quantity) || fill.quantity <= 0) throw new Error('paper fill quantity must be greater than 0')
    if (!Number.isFinite(fill.price) || fill.price <= 0) throw new Error('paper fill price must be greater than 0')
    if (!Number.isFinite(fill.fee) || fill.fee < 0) throw new Error('paper fill fee must be non-negative')
    if (!Number.isFinite(fill.slippage) || fill.slippage < 0) throw new Error('paper fill slippage must be non-negative')
    quantity += fill.quantity
    grossNotional += fill.quantity * fill.price
    fees += fill.fee
    totalSlippage += fill.slippage
  }

  return {
    quantity,
    grossNotional,
    fees,
    averagePrice: grossNotional / quantity,
    totalSlippage,
  }
}

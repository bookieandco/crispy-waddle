export type SharkPaperSide = 'buy' | 'sell'
export type SharkPaperOrderType = 'market' | 'limit'
export type SharkPaperOrderStatus = 'filled' | 'partially_filled' | 'rejected'

export type SharkPaperOrder = {
  id: string
  decisionId: string
  opportunityId: string
  side: SharkPaperSide
  orderType: SharkPaperOrderType
  quantity: number
  limitPrice?: number
  submittedAt: string
}

export type SharkPaperFill = {
  orderId: string
  quantity: number
  price: number
  fee: number
  slippage: number
  filledAt: string
}

export type SharkPaperPosition = {
  opportunityId: string
  quantity: number
  averageEntryPrice: number
  realizedPnl: number
  unrealizedPnl: number
}

export type SharkPaperBalance = {
  currency: string
  available: number
  reserved: number
}

export type SharkPaperExecutionResult = {
  order: SharkPaperOrder
  status: SharkPaperOrderStatus
  fills: SharkPaperFill[]
  position: SharkPaperPosition
  balance: SharkPaperBalance
  simulated: true
}

export function validateSharkPaperOrder(order: SharkPaperOrder): string[] {
  const errors: string[] = []
  if (!order.id) errors.push('id is required')
  if (!order.decisionId) errors.push('decisionId is required')
  if (!order.opportunityId) errors.push('opportunityId is required')
  if (!Number.isFinite(order.quantity) || order.quantity <= 0) errors.push('quantity must be greater than 0')
  if (order.limitPrice !== undefined && (!Number.isFinite(order.limitPrice) || order.limitPrice <= 0)) errors.push('limitPrice must be greater than 0')
  if (!order.submittedAt) errors.push('submittedAt is required')
  return errors
}

/** Paper-only state transition. This function has no wallet, signer, RPC, or live-order capability. */
export function executeSharkPaperOrder(input: {
  order: SharkPaperOrder
  fillPrice: number
  fee: number
  slippage: number
  currentPosition?: SharkPaperPosition
  balance?: SharkPaperBalance
  filledAt?: string
}): SharkPaperExecutionResult {
  const errors = validateSharkPaperOrder(input.order)
  if (errors.length) throw new Error(`invalid Shark paper order: ${errors.join(', ')}`)
  if (!Number.isFinite(input.fillPrice) || input.fillPrice <= 0) throw new Error('fillPrice must be greater than 0')
  if (!Number.isFinite(input.fee) || input.fee < 0) throw new Error('fee must be non-negative')
  if (!Number.isFinite(input.slippage) || input.slippage < 0) throw new Error('slippage must be non-negative')

  const fill = { orderId: input.order.id, quantity: input.order.quantity, price: input.fillPrice, fee: input.fee, slippage: input.slippage, filledAt: input.filledAt ?? input.order.submittedAt }
  const position = input.currentPosition ?? { opportunityId: input.order.opportunityId, quantity: 0, averageEntryPrice: 0, realizedPnl: 0, unrealizedPnl: 0 }
  const notional = fill.quantity * fill.price
  const signedQuantity = input.order.side === 'buy' ? fill.quantity : -fill.quantity
  const nextQuantity = position.quantity + signedQuantity
  const averageEntryPrice = input.order.side === 'buy' && nextQuantity > 0
    ? (position.quantity * position.averageEntryPrice + notional) / nextQuantity
    : position.averageEntryPrice
  const nextBalance = input.balance ?? { currency: 'USD', available: 0, reserved: 0 }
  const cashDelta = input.order.side === 'buy' ? -(notional + input.fee) : notional - input.fee

  return {
    order: input.order,
    status: 'filled',
    fills: [fill],
    position: { ...position, quantity: nextQuantity, averageEntryPrice, realizedPnl: position.realizedPnl, unrealizedPnl: position.unrealizedPnl },
    balance: { ...nextBalance, available: nextBalance.available + cashDelta },
    simulated: true,
  }
}

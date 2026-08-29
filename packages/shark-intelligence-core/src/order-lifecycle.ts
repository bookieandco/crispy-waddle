export type SharkPaperLifecycleState = 'created' | 'submitted' | 'partially_filled' | 'filled' | 'cancelled' | 'rejected'

export type SharkPaperLifecycleEvent = {
  orderId: string
  decisionId: string
  opportunityId: string
  state: SharkPaperLifecycleState
  at: string
  fillQuantity?: number
  fillId?: string
}

const terminalStates = new Set<SharkPaperLifecycleState>(['filled', 'cancelled', 'rejected'])

const transitions: Record<SharkPaperLifecycleState, SharkPaperLifecycleState[]> = {
  created: ['submitted', 'rejected'],
  submitted: ['partially_filled', 'filled', 'cancelled', 'rejected'],
  partially_filled: ['partially_filled', 'filled', 'cancelled'],
  filled: [],
  cancelled: [],
  rejected: [],
}

export function canTransitionSharkPaperOrder(from: SharkPaperLifecycleState, to: SharkPaperLifecycleState): boolean {
  return transitions[from].includes(to)
}

export function assertSharkPaperTransition(from: SharkPaperLifecycleState, to: SharkPaperLifecycleState): void {
  if (!canTransitionSharkPaperOrder(from, to)) throw new Error(`invalid paper order transition: ${from} -> ${to}`)
}

export function isTerminalSharkPaperState(state: SharkPaperLifecycleState): boolean {
  return terminalStates.has(state)
}

export function validateSharkPaperFillQuantity(orderQuantity: number, filledQuantity: number, fillQuantity: number): number {
  if (!Number.isFinite(orderQuantity) || orderQuantity <= 0) throw new Error('order quantity must be greater than 0')
  if (!Number.isFinite(filledQuantity) || filledQuantity < 0) throw new Error('filled quantity must be non-negative')
  if (!Number.isFinite(fillQuantity) || fillQuantity <= 0) throw new Error('fill quantity must be greater than 0')
  const nextFilled = filledQuantity + fillQuantity
  if (nextFilled > orderQuantity) throw new Error('paper fill exceeds order quantity')
  return nextFilled
}

export function lifecycleStateForFill(orderQuantity: number, filledQuantity: number): SharkPaperLifecycleState {
  if (filledQuantity <= 0) return 'submitted'
  if (filledQuantity < orderQuantity) return 'partially_filled'
  return 'filled'
}

export type DlmmPositionState = {
  positionAddress: string
  poolAddress: string
  owner?: string
  operator?: string
  lowerBinId?: number
  upperBinId?: number
  activeBinId?: number
  lifecycle: 'UNKNOWN' | 'OPEN' | 'ACTIVE' | 'CLOSED'
  liquidityState: 'UNKNOWN' | 'FUNDED' | 'PARTIAL' | 'EMPTY'
  tokenXRaw: bigint
  tokenYRaw: bigint
  openedAt?: string
  lastObservedAt: string
  evidenceIds: string[]
}

export type DlmmPositionTransition = {
  eventId: string
  signature: string
  positionAddress: string
  poolAddress: string
  tokenMint?: string
  action: 'OPEN' | 'ADD' | 'REMOVE' | 'REBALANCE' | 'CLAIM_FEE' | 'CLOSE'
  owner?: string
  operator?: string
  fromBinId?: number
  toBinId?: number
  activeBinId?: number
  removedBps?: number
  oneSided?: boolean
  tokenXDeltas?: bigint
  tokenYDeltas?: bigint
  observedAt: string
  evidenceIds: string[]
  confidence: number
  semantic: 'EXPLICIT' | 'INFERRED'
}

export type DlmmPositionTransitionResult = {
  state?: DlmmPositionState
  withdrawal?: DlmmPositionTransition
  rejected?: string
}

const validTimestamp = (value: string) => Number.isFinite(Date.parse(value))
const validBin = (value?: number) => value === undefined || Number.isInteger(value)
const validBps = (value?: number) => value === undefined || (Number.isInteger(value) && value >= 0 && value <= 10_000)
const nonNegative = (value?: bigint) => value === undefined || value >= 0n

function liquidityState(x: bigint, y: bigint): DlmmPositionState['liquidityState'] {
  if (x < 0n || y < 0n) return 'UNKNOWN'
  if (x === 0n && y === 0n) return 'EMPTY'
  return x > 0n && y > 0n ? 'FUNDED' : 'PARTIAL'
}

function mergeEvidence(current: string[], next: string[]) {
  return [...new Set([...current, ...next])]
}

export function applyDlmmPositionTransition(
  current: DlmmPositionState | undefined,
  transition: DlmmPositionTransition,
): DlmmPositionTransitionResult {
  if (!transition.eventId || !transition.signature || !transition.positionAddress || !transition.poolAddress) return { rejected: 'INVALID_IDENTITY' }
  if (!validTimestamp(transition.observedAt)) return { rejected: 'INVALID_TIMESTAMP' }
  if (transition.evidenceIds.length === 0) return { rejected: 'MISSING_EVIDENCE' }
  if (!Number.isFinite(transition.confidence) || transition.confidence < 0 || transition.confidence > 1) return { rejected: 'INVALID_CONFIDENCE' }
  if (!validBps(transition.removedBps) || !validBin(transition.fromBinId) || !validBin(transition.toBinId) || !validBin(transition.activeBinId)) return { rejected: 'INVALID_RANGE' }
  if (!nonNegative(transition.tokenXDeltas) || !nonNegative(transition.tokenYDeltas)) return { rejected: 'NEGATIVE_DELTA' }

  if (current && Date.parse(transition.observedAt) < Date.parse(current.lastObservedAt)) return { rejected: 'STATE_REGRESSION' }
  if (transition.action !== 'OPEN' && !current) return { rejected: 'MISSING_OPEN' }

  if (transition.action === 'OPEN') {
    if (current) return { rejected: 'DUPLICATE_OPEN' }
    const x = transition.tokenXDeltas ?? 0n
    const y = transition.tokenYDeltas ?? 0n
    const state: DlmmPositionState = {
      positionAddress: transition.positionAddress,
      poolAddress: transition.poolAddress,
      owner: transition.owner,
      operator: transition.operator,
      lowerBinId: transition.fromBinId,
      upperBinId: transition.toBinId,
      activeBinId: transition.activeBinId,
      lifecycle: x > 0n || y > 0n ? 'ACTIVE' : 'OPEN',
      liquidityState: liquidityState(x, y),
      tokenXRaw: x,
      tokenYRaw: y,
      openedAt: transition.observedAt,
      lastObservedAt: transition.observedAt,
      evidenceIds: [...new Set(transition.evidenceIds)],
    }
    return { state }
  }

  if (!current) return { rejected: 'MISSING_STATE' }
  if (current.poolAddress !== transition.poolAddress) return { rejected: 'POOL_MISMATCH' }
  if (current.positionAddress !== transition.positionAddress) return { rejected: 'POSITION_MISMATCH' }
  if (current.lifecycle === 'CLOSED' && transition.action !== 'CLAIM_FEE') return { rejected: 'CLOSED_POSITION' }

  const xDelta = transition.tokenXDeltas ?? 0n
  const yDelta = transition.tokenYDeltas ?? 0n
  let x = current.tokenXRaw
  let y = current.tokenYRaw
  let lifecycle = current.lifecycle
  let lower = current.lowerBinId
  let upper = current.upperBinId
  let active = current.activeBinId

  if (transition.action === 'ADD') {
    x += xDelta; y += yDelta; lifecycle = 'ACTIVE'
  } else if (transition.action === 'REMOVE') {
    if (xDelta > x || yDelta > y) return { rejected: 'LIQUIDITY_UNDERFLOW' }
    x -= xDelta; y -= yDelta
    lifecycle = x === 0n && y === 0n ? 'OPEN' : 'ACTIVE'
  } else if (transition.action === 'REBALANCE') {
    lower = transition.fromBinId ?? lower
    upper = transition.toBinId ?? upper
    active = transition.activeBinId ?? active
  } else if (transition.action === 'CLOSE') {
    if (x !== 0n || y !== 0n) return { rejected: 'CLOSE_WITH_LIQUIDITY' }
    lifecycle = 'CLOSED'
  }

  const state: DlmmPositionState = {
    ...current,
    owner: transition.owner ?? current.owner,
    operator: transition.operator ?? current.operator,
    lowerBinId: lower,
    upperBinId: upper,
    activeBinId: active,
    lifecycle,
    liquidityState: liquidityState(x, y),
    tokenXRaw: x,
    tokenYRaw: y,
    lastObservedAt: transition.observedAt,
    evidenceIds: mergeEvidence(current.evidenceIds, transition.evidenceIds),
  }
  return { state, withdrawal: transition.action === 'REMOVE' ? transition : undefined }
}

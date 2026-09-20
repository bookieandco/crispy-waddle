/** Read-only Meteora DLMM intelligence boundary. No transaction construction or execution authority. */
export const METEORA_DLMM_PROGRAM_ID = 'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo'

export type MeteoraDlmmBinEvidence = Readonly<{
  binId: number
  amountX: bigint
  amountY: bigint
}>

export type MeteoraDlmmPositionEvidence = Readonly<{
  evidenceId: string
  observedAt: string
  programId: typeof METEORA_DLMM_PROGRAM_ID
  lbPair: string
  position: string
  owner: string
  lowerBinId: number
  upperBinId: number
  bins: readonly MeteoraDlmmBinEvidence[]
}>

export type MeteoraDlmmLiquidityDelta = Readonly<{
  evidenceId: string
  observedAt: string
  venue: 'meteora-dlmm'
  poolAddress: string
  position: string
  owner: string
  kind: 'LIQUIDITY_ADD' | 'LIQUIDITY_REMOVE' | 'REBALANCE' | 'UNKNOWN'
  lowerBinId: number
  upperBinId: number
  tokenXDelta: bigint
  tokenYDelta: bigint
  grossAddedX: bigint
  grossAddedY: bigint
  grossRemovedX: bigint
  grossRemovedY: bigint
}>

function total(position: MeteoraDlmmPositionEvidence, side: 'amountX' | 'amountY'): bigint {
  return position.bins.reduce((sum, bin) => sum + bin[side], 0n)
}

export function createMeteoraDlmmPositionEvidence(
  input: Omit<MeteoraDlmmPositionEvidence, 'programId'> & { programId?: string },
): MeteoraDlmmPositionEvidence {
  if (input.programId && input.programId !== METEORA_DLMM_PROGRAM_ID) throw new Error('Unexpected Meteora DLMM program owner')
  if (!input.evidenceId || !input.lbPair || !input.position || !input.owner) throw new Error('Incomplete Meteora DLMM evidence')
  if (!Number.isInteger(input.lowerBinId) || !Number.isInteger(input.upperBinId) || input.lowerBinId > input.upperBinId) throw new Error('Invalid Meteora DLMM bin range')
  const seenBins = new Set<number>()
  for (const bin of input.bins) {
    if (!Number.isInteger(bin.binId) || bin.binId < input.lowerBinId || bin.binId > input.upperBinId) throw new Error('Meteora DLMM bin outside position range')
    if (seenBins.has(bin.binId)) throw new Error('Duplicate Meteora DLMM bin evidence')
    seenBins.add(bin.binId)
    if (bin.amountX < 0n || bin.amountY < 0n) throw new Error('Negative Meteora DLMM bin amount')
  }
  return Object.freeze({ ...input, programId: METEORA_DLMM_PROGRAM_ID, bins: Object.freeze(input.bins.map(bin => Object.freeze({ ...bin }))) })
}

/**
 * Reconciles two verified snapshots into normalized liquidity evidence.
 * REBALANCE is deliberately distinct from removal so strategy movement is not
 * automatically treated as adversarial withdrawal.
 */
export function reconcileMeteoraDlmmPosition(
  before: MeteoraDlmmPositionEvidence,
  after: MeteoraDlmmPositionEvidence,
  evidenceId: string,
): MeteoraDlmmLiquidityDelta {
  if (before.lbPair !== after.lbPair || before.position !== after.position || before.owner !== after.owner) throw new Error('Meteora DLMM position identity mismatch')
  const x = total(after, 'amountX') - total(before, 'amountX')
  const y = total(after, 'amountY') - total(before, 'amountY')
  const beforeBins = new Map(before.bins.map(bin => [bin.binId, bin]))
  const afterBins = new Map(after.bins.map(bin => [bin.binId, bin]))
  const binIds = new Set([...beforeBins.keys(), ...afterBins.keys()])
  let grossAddedX = 0n; let grossAddedY = 0n; let grossRemovedX = 0n; let grossRemovedY = 0n
  for (const binId of binIds) {
    const prior = beforeBins.get(binId)
    const next = afterBins.get(binId)
    const dx = (next?.amountX ?? 0n) - (prior?.amountX ?? 0n)
    const dy = (next?.amountY ?? 0n) - (prior?.amountY ?? 0n)
    if (dx > 0n) grossAddedX += dx
    if (dx < 0n) grossRemovedX += -dx
    if (dy > 0n) grossAddedY += dy
    if (dy < 0n) grossRemovedY += -dy
  }

  const rangeChanged = before.lowerBinId !== after.lowerBinId || before.upperBinId !== after.upperBinId
  const hasGrossAdd = grossAddedX > 0n || grossAddedY > 0n
  const hasGrossRemove = grossRemovedX > 0n || grossRemovedY > 0n
  const pureAdd = hasGrossAdd && !hasGrossRemove
  const pureRemove = hasGrossRemove && !hasGrossAdd
  // Any simultaneous per-bin add/remove is a range movement until transaction
  // evidence proves an actual withdrawal. Net token deltas alone cannot safely
  // distinguish a rebalance from adversarial liquidity extraction.
  const kind = (rangeChanged || (hasGrossAdd && hasGrossRemove))
    ? 'REBALANCE'
    : pureAdd ? 'LIQUIDITY_ADD'
      : pureRemove ? 'LIQUIDITY_REMOVE'
        : 'UNKNOWN'
  return Object.freeze({
    evidenceId,
    observedAt: after.observedAt,
    venue: 'meteora-dlmm',
    poolAddress: after.lbPair,
    position: after.position,
    owner: after.owner,
    kind,
    lowerBinId: after.lowerBinId,
    upperBinId: after.upperBinId,
    tokenXDelta: x,
    tokenYDelta: y,
    grossAddedX,
    grossAddedY,
    grossRemovedX,
    grossRemovedY,
  })
}

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
  for (const bin of input.bins) {
    if (!Number.isInteger(bin.binId) || bin.binId < input.lowerBinId || bin.binId > input.upperBinId) throw new Error('Meteora DLMM bin outside position range')
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
  const rangeChanged = before.lowerBinId !== after.lowerBinId || before.upperBinId !== after.upperBinId
  const increased = x > 0n || y > 0n
  const decreased = x < 0n || y < 0n
  const kind = rangeChanged && (increased || decreased) ? 'REBALANCE' : increased && !decreased ? 'LIQUIDITY_ADD' : decreased && !increased ? 'LIQUIDITY_REMOVE' : 'UNKNOWN'
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
  })
}

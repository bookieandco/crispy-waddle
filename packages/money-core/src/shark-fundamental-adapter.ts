import type { EvidenceRef } from './financial-intelligence-contracts.js'
import type { FundamentalState } from './issuer-reality-contracts.js'

/**
 * MONEY-035 → SHARK boundary.
 *
 * This is intentionally a data-only adapter. It does not import SHARK, create
 * predictions, emit trade signals, or expose execution capabilities. SHARK
 * may interpret this input, but cannot mutate the underlying issuer reality.
 */
export type SharkFundamentalInput = Readonly<{
  issuerId: string
  instrumentId: string
  informationCutoff: string
  fundamentalStateId: string
  factIds: readonly string[]
  evidenceRefs: readonly EvidenceRef[]
  inputSnapshotHash: string
  methodologyVersion: string
}>

export function toSharkFundamentalInput(
  state: FundamentalState,
  instrumentId: string,
): SharkFundamentalInput {
  if (!instrumentId.trim()) throw new Error('instrumentId is required')
  return Object.freeze({
    issuerId: state.issuerId,
    instrumentId,
    informationCutoff: state.informationCutoff,
    fundamentalStateId: state.stateId,
    factIds: Object.freeze([...state.factIds]),
    evidenceRefs: Object.freeze([...state.evidenceRefs]),
    inputSnapshotHash: state.inputSnapshotHash,
    methodologyVersion: state.methodologyVersion,
  })
}

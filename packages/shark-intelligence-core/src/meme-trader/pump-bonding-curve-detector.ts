export const PUMP_PROGRAM_ID = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P'

export type PumpBondingCurveState = {
  mint: string
  bondingCurve: string
  virtualTokenReserves: bigint
  virtualQuoteReserves: bigint
  realTokenReserves: bigint
  realQuoteReserves: bigint
  tokenTotalSupply: bigint
  complete: boolean
  observedAt: string
  slot?: number
  signature?: string
  evidenceIds: string[]
}

export type PumpGraduationPhase = 'ACTIVE' | 'NEAR_GRADUATION' | 'COMPLETED' | 'MIGRATED' | 'INVALID'

export type PumpGraduationObservation = {
  observationId: string
  mint: string
  bondingCurve: string
  phase: PumpGraduationPhase
  completion: number
  remainingRealTokenRatio: number
  realQuoteReserve: bigint
  observedAt: string
  slot?: number
  signature?: string
  evidenceIds: string[]
  provenance: {
    programId: string
    source: string
  }
}

export type PumpGraduationDetectorConfig = {
  /** Fraction of the initial real-token reserve remaining at which to enter NEAR_GRADUATION. */
  nearGraduationRemainingRatio?: number
  source?: string
}

const DEFAULT_NEAR_GRADUATION_REMAINING_RATIO = 0.01

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))

function finiteRatio(numerator: bigint, denominator: bigint): number | null {
  if (denominator <= 0n || numerator < 0n) return null
  return Number(numerator) / Number(denominator)
}

/**
 * Converts an on-chain Pump bonding-curve state into a conservative graduation
 * observation. This is deliberately state-based: it does not infer graduation
 * from USD market cap or a hard-coded SOL threshold.
 */
export function observePumpBondingCurve(
  state: PumpBondingCurveState,
  initialRealTokenReserves: bigint,
  config: PumpGraduationDetectorConfig = {},
): PumpGraduationObservation {
  const remainingRatio = finiteRatio(state.realTokenReserves, initialRealTokenReserves)
  const source = config.source ?? 'pump-bonding-curve'
  const evidenceIds = [...new Set(state.evidenceIds)]

  if (remainingRatio === null || !state.mint || !state.bondingCurve || !state.observedAt || evidenceIds.length === 0) {
    return {
      observationId: `pump-graduation:invalid:${state.mint || 'unknown'}:${state.observedAt || 'unknown'}`,
      mint: state.mint,
      bondingCurve: state.bondingCurve,
      phase: 'INVALID',
      completion: 0,
      remainingRealTokenRatio: 1,
      realQuoteReserve: state.realQuoteReserves,
      observedAt: state.observedAt,
      slot: state.slot,
      signature: state.signature,
      evidenceIds,
      provenance: { programId: PUMP_PROGRAM_ID, source },
    }
  }

  const completion = clamp01(1 - remainingRatio)
  const nearThreshold = clamp01(config.nearGraduationRemainingRatio ?? DEFAULT_NEAR_GRADUATION_REMAINING_RATIO)
  const phase: PumpGraduationPhase = state.complete
    ? 'COMPLETED'
    : remainingRatio <= nearThreshold
      ? 'NEAR_GRADUATION'
      : 'ACTIVE'

  const observationId = `pump-graduation:${state.mint}:${state.signature ?? state.slot ?? state.observedAt}:${phase}`
  return {
    observationId,
    mint: state.mint,
    bondingCurve: state.bondingCurve,
    phase,
    completion,
    remainingRealTokenRatio: remainingRatio,
    realQuoteReserve: state.realQuoteReserves,
    observedAt: state.observedAt,
    slot: state.slot,
    signature: state.signature,
    evidenceIds,
    provenance: { programId: PUMP_PROGRAM_ID, source },
  }
}

export type PumpGraduationSniperSignal = {
  signalId: string
  mint: string
  bondingCurve: string
  trigger: 'CROSSED_NEAR_GRADUATION' | 'COMPLETED'
  phase: 'NEAR_GRADUATION' | 'COMPLETED'
  completion: number
  observedAt: string
  evidenceIds: string[]
  /** Explicitly non-executable. Money Core must make any financial proposal. */
  executionAllowed: false
}

/**
 * Produces a paper/intelligence signal only. It never builds a transaction,
 * selects a wallet, sizes a position, or authorizes execution.
 */
export function detectPumpGraduationSniper(
  current: PumpGraduationObservation,
  previous?: PumpGraduationObservation,
): PumpGraduationSniperSignal | null {
  if (current.phase === 'COMPLETED') {
    return {
      signalId: `pump-sniper:completed:${current.mint}:${current.signature ?? current.observedAt}`,
      mint: current.mint,
      bondingCurve: current.bondingCurve,
      trigger: 'COMPLETED',
      phase: 'COMPLETED',
      completion: current.completion,
      observedAt: current.observedAt,
      evidenceIds: current.evidenceIds,
      executionAllowed: false,
    }
  }

  if (current.phase !== 'NEAR_GRADUATION') return null

  const crossed = !previous || previous.phase === 'ACTIVE' || previous.phase === 'INVALID'
  if (!crossed) return null

  return {
    signalId: `pump-sniper:near:${current.mint}:${current.signature ?? current.observedAt}`,
    mint: current.mint,
    bondingCurve: current.bondingCurve,
    trigger: 'CROSSED_NEAR_GRADUATION',
    phase: 'NEAR_GRADUATION',
    completion: current.completion,
    observedAt: current.observedAt,
    evidenceIds: current.evidenceIds,
    executionAllowed: false,
  }
}

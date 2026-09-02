import { applyLaunchOutcome, deriveActorOutcomeHistory, evaluateLaunchOutcome, type LaunchOutcomeAssessment } from './launch-outcome-engine'
import type { TokenLaunch } from './wallet-launch-pipeline'

export type PersistedLaunchOutcomeObservation = {
  observationId: string
  launchId: string
  observedAt: string
  priceReturnFromLaunchPct?: number
  peakReturnPct?: number
  maxDrawdownPct?: number
  initialLiquidityUsd?: number
  currentLiquidityUsd?: number
  peakLiquidityUsd?: number
  liquidityDrawdownFromPeak?: number
  liquidityDrainRate?: number
  liquidityDrainAcceleration?: number
  liquidityStabilityScore?: number
  holderCountChangePct?: number
  holderExitPct?: number
  developerSoldPct?: number
  liquidityRemoved?: boolean
  tradingHalted?: boolean
  holderBehavior?: 'ACCUMULATING' | 'STABLE' | 'DISTRIBUTING' | 'PANIC_EXIT'
  evidenceIds: string[]
  source: string
}

export type LaunchOutcomeWorkerResult = {
  evaluated: number
  changed: number
  unchanged: number
  unknown: number
  assessments: Array<{ launchId: string; assessment: LaunchOutcomeAssessment; updatedLaunch: TokenLaunch }>
  actorHistories: Array<{ actorKey: string; actorId: string; actorKind: 'wallet' | 'developer' | 'cluster'; history: ReturnType<typeof deriveActorOutcomeHistory> }>
}

const latestByLaunch = (observations: PersistedLaunchOutcomeObservation[]) => {
  const latest = new Map<string, PersistedLaunchOutcomeObservation>()
  for (const observation of observations) {
    const current = latest.get(observation.launchId)
    if (!current || Date.parse(observation.observedAt) > Date.parse(current.observedAt)) latest.set(observation.launchId, observation)
  }
  return latest
}

/**
 * Deterministic batch evaluator. It never treats missing observations as a healthy outcome.
 * Unknown launches remain UNKNOWN until a later observation window supplies enough evidence.
 */
export function evaluateLaunchOutcomeBatch(input: {
  launches: TokenLaunch[]
  observations: PersistedLaunchOutcomeObservation[]
  evaluatedAt: string
}): LaunchOutcomeWorkerResult {
  const latest = latestByLaunch(input.observations)
  const assessments: LaunchOutcomeWorkerResult['assessments'] = []
  let unchanged = 0
  let unknown = 0

  for (const launch of input.launches) {
    const observation = latest.get(launch.launchId)
    if (!observation) {
      unknown += 1
      continue
    }

    const assessment = evaluateLaunchOutcome({
      launch,
      evaluatedAt: input.evaluatedAt,
      priceReturnFromLaunchPct: observation.priceReturnFromLaunchPct,
      peakReturnPct: observation.peakReturnPct,
      maxDrawdownPct: observation.maxDrawdownPct,
      liquidityHistory: observation.liquidityDrawdownFromPeak !== undefined || observation.liquidityDrainRate !== undefined || observation.liquidityStabilityScore !== undefined
        ? {
            initialLiquidityUsd: observation.initialLiquidityUsd ?? 0,
            currentLiquidityUsd: observation.currentLiquidityUsd ?? 0,
            peakLiquidityUsd: observation.peakLiquidityUsd ?? observation.currentLiquidityUsd ?? 0,
            drawdownFromPeak: observation.liquidityDrawdownFromPeak ?? 0,
            drainRate: observation.liquidityDrainRate ?? 0,
            drainAcceleration: observation.liquidityDrainAcceleration ?? 0,
            stabilityScore: observation.liquidityStabilityScore ?? 0,
            evidenceIds: observation.evidenceIds,
          }
        : undefined,
      holderCountChangePct: observation.holderCountChangePct,
      holderExitPct: observation.holderExitPct,
      developerSoldPct: observation.developerSoldPct,
      liquidityRemoved: observation.liquidityRemoved,
      tradingHalted: observation.tradingHalted,
      holderBehavior: observation.holderBehavior,
      evidence: observation.evidenceIds.map(evidenceId => ({ evidenceId, observedAt: observation.observedAt, kind: 'transaction', label: evidenceId })),
    })

    const updatedLaunch = applyLaunchOutcome(launch, assessment)
    if (assessment.outcome === 'UNKNOWN') unknown += 1
    if (updatedLaunch.outcome === launch.outcome) unchanged += 1
    assessments.push({ launchId: launch.launchId, assessment, updatedLaunch })
  }

  const byActor = new Map<string, { actorId: string; actorKind: 'wallet' | 'developer' | 'cluster'; launches: TokenLaunch[] }>()
  for (const launch of input.launches.map((candidate) => assessments.find(x => x.launchId === candidate.launchId)?.updatedLaunch ?? candidate)) {
    const actors: Array<[string, string | undefined, 'wallet' | 'developer' | 'cluster']> = [
      ['wallet', launch.deployerWalletId, 'wallet'],
      ['developer', launch.developerEntityId, 'developer'],
      ['cluster', launch.clusterId, 'cluster'],
    ]
    for (const [prefix, actorId, actorKind] of actors) {
      if (!actorId) continue
      const actorKey = `${prefix}:${actorId}`
      const current = byActor.get(actorKey) ?? { actorId, actorKind, launches: [] }
      current.launches.push(launch)
      byActor.set(actorKey, current)
    }
  }

  const actorHistories = [...byActor.entries()].map(([actorKey, value]) => ({
    actorKey,
    actorId: value.actorId,
    actorKind: value.actorKind,
    history: deriveActorOutcomeHistory(value.actorId, value.launches),
  }))

  return {
    evaluated: assessments.length,
    changed: assessments.filter(x => x.updatedLaunch.outcome !== input.launches.find(l => l.launchId === x.launchId)?.outcome).length,
    unchanged,
    unknown,
    assessments,
    actorHistories,
  }
}

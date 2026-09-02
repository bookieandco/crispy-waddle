export type WalletRole = 'developer' | 'deployer' | 'funder' | 'early-buyer' | 'liquidity-provider' | 'unknown'
export type EntityKind = 'wallet' | 'developer' | 'organization' | 'cluster'
export type LaunchOutcome = 'UNKNOWN' | 'HEALTHY' | 'RUG' | 'FAILED' | 'PUMP_AND_DUMP'
export type CandidateDisposition = 'WATCH' | 'REVIEW' | 'BLOCK'

export type WalletEntityLink = {
  walletId: string
  entityId: string
  entityKind: EntityKind
  role: WalletRole
  confidence: number
  evidenceIds: string[]
  observedAt: string
}

export type TokenLaunch = {
  launchId: string
  chainId: string
  tokenAddress: string
  deployerWalletId?: string
  developerEntityId?: string
  clusterId?: string
  launchedAt: string
  launchpad?: string
  initialLiquidityUsd?: number
  outcome: LaunchOutcome
  outcomeObservedAt?: string
  evidenceIds: string[]
}

export type LaunchBehaviorSignal = {
  walletId: string
  entityId?: string
  clusterId?: string
  priorLaunches: number
  healthyLaunches: number
  badLaunches: number
  rugRate?: number
  medianTimeToFirstBuySeconds?: number
  medianInitialBuyUsd?: number
  liquidityRemovalRate?: number
  earlyBuyerRepeatRate?: number
  evidenceIds: string[]
  confidence: number
}

export type SniperCandidate = {
  candidateId: string
  chainId: string
  tokenAddress: string
  launchId: string
  developerWalletId?: string
  developerEntityId?: string
  clusterId?: string
  disposition: CandidateDisposition
  score: number
  reasons: string[]
  blockers: string[]
  behaviorSignals: LaunchBehaviorSignal[]
  evidenceIds: string[]
  observedAt: string
  version: string
}

const clamp = (value: number) => Math.max(0, Math.min(1, value))
const finite = (value: unknown): number | undefined => typeof value === 'number' && Number.isFinite(value) ? value : undefined

/**
 * Deterministic developer/entity behavior aggregation. Unknown outcomes never count as
 * good or bad, preventing missing labels from becoming false positive alpha.
 */
export function deriveLaunchBehaviorSignal(input: {
  walletId: string
  entityId?: string
  clusterId?: string
  launches: Array<TokenLaunch & {
    timeToFirstBuySeconds?: number
    initialBuyUsd?: number
    liquidityRemoved?: boolean
    repeatedEarlyBuyer?: boolean
  }>
  evidenceIds?: string[]
}): LaunchBehaviorSignal {
  const prior = input.launches.length
  const healthy = input.launches.filter(x => x.outcome === 'HEALTHY').length
  const bad = input.launches.filter(x => x.outcome === 'RUG' || x.outcome === 'PUMP_AND_DUMP').length
  const firstBuys = input.launches.map(x => finite(x.timeToFirstBuySeconds)).filter((x): x is number => x !== undefined)
  const initialBuys = input.launches.map(x => finite(x.initialBuyUsd)).filter((x): x is number => x !== undefined)
  const removalObserved = input.launches.filter(x => typeof x.liquidityRemoved === 'boolean')
  const repeatObserved = input.launches.filter(x => typeof x.repeatedEarlyBuyer === 'boolean')
  const median = (values: number[]) => {
    if (!values.length) return undefined
    const sorted = [...values].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
  }
  const evidence = new Set(input.evidenceIds ?? [])
  input.launches.forEach(x => x.evidenceIds.forEach(id => evidence.add(id)))
  return {
    walletId: input.walletId,
    entityId: input.entityId,
    clusterId: input.clusterId,
    priorLaunches: prior,
    healthyLaunches: healthy,
    badLaunches: bad,
    rugRate: prior ? bad / prior : undefined,
    medianTimeToFirstBuySeconds: median(firstBuys),
    medianInitialBuyUsd: median(initialBuys),
    liquidityRemovalRate: removalObserved.length ? removalObserved.filter(x => x.liquidityRemoved).length / removalObserved.length : undefined,
    earlyBuyerRepeatRate: repeatObserved.length ? repeatObserved.filter(x => x.repeatedEarlyBuyer).length / repeatObserved.length : undefined,
    evidenceIds: [...evidence],
    confidence: clamp(Math.min(1, prior / 10)),
  }
}

/**
 * Turns public launch/developer evidence into a non-executing candidate. A bad historical
 * developer/cluster can block observation, but a good history can never authorize a trade.
 */
export function buildSniperCandidate(input: {
  launch: TokenLaunch
  behaviorSignals: LaunchBehaviorSignal[]
  structuralRisk?: number
  evidenceIds?: string[]
  observedAt: string
}): SniperCandidate {
  const signals = input.behaviorSignals
  const blockers: string[] = []
  const reasons: string[] = []
  const evidence = new Set(input.evidenceIds ?? [])
  input.launch.evidenceIds.forEach(id => evidence.add(id))
  signals.forEach(signal => signal.evidenceIds.forEach(id => evidence.add(id)))

  const badHistory = signals.reduce((sum, s) => sum + (s.rugRate ?? 0) * s.confidence, 0)
  const weight = signals.reduce((sum, s) => sum + s.confidence, 0)
  const historicalBadRate = weight ? clamp(badHistory / weight) : 0
  const structural = clamp(input.structuralRisk ?? 0)

  if (input.launch.outcome === 'RUG') blockers.push('launch-already-labeled-rug')
  if (historicalBadRate >= 0.7) blockers.push('developer-or-cluster-has-high-bad-launch-rate')
  if (structural >= 0.8) blockers.push('structural-risk-high')
  if (historicalBadRate > 0) reasons.push(`Historical developer/entity/cluster bad-launch rate=${historicalBadRate.toFixed(3)}.`)
  if (signals.some(s => (s.healthyLaunches ?? 0) > 0)) reasons.push('Historical launch outcomes provide positive behavioral evidence, not execution authority.')
  if (signals.some(s => (s.earlyBuyerRepeatRate ?? 0) >= 0.5)) reasons.push('Repeated early-buyer behavior is present and should be checked for related-wallet clustering.')
  if (!signals.length) reasons.push('No historical developer/entity/cluster behavior is available; candidate remains evidence-poor.')

  const historyQuality = clamp(weight / 3)
  const score = clamp(.45 * (1 - historicalBadRate) + .25 * historyQuality + .30 * (1 - structural))
  const disposition: CandidateDisposition = blockers.length ? 'BLOCK' : score >= 0.65 ? 'WATCH' : 'REVIEW'

  return {
    candidateId: `sniper-candidate:${input.launch.launchId}`,
    chainId: input.launch.chainId,
    tokenAddress: input.launch.tokenAddress,
    launchId: input.launch.launchId,
    developerWalletId: input.launch.deployerWalletId,
    developerEntityId: input.launch.developerEntityId,
    clusterId: input.launch.clusterId,
    disposition,
    score,
    reasons,
    blockers,
    behaviorSignals: signals,
    evidenceIds: [...evidence],
    observedAt: input.observedAt,
    version: 'wallet-launch-sniper-v1',
  }
}

import type { TokenLaunch } from './wallet-launch-pipeline'
import { deriveTokenActorGraph, type EntityGraph } from './entity-graph'

export type TokenLaunchObservation = {
  observationId: string
  chainId: string
  tokenAddress: string
  observedAt: string
  deployerWalletId?: string
  funderWalletIds?: string[]
  liquidityProviderWalletIds?: string[]
  earlyBuyerWalletIds?: string[]
  launchpad?: string
  initialLiquidityUsd?: number
  evidenceIds: string[]
  source: string
}

export type TokenLaunchIngestResult = { launch: TokenLaunch; graph: EntityGraph; duplicate: boolean }
const seen = new Set<string>()
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0
const assertTimestamp = (value: string) => { if (!value || Number.isNaN(Date.parse(value))) throw new Error('Invalid token launch timestamp.') }

export function ingestTokenLaunch(observation: TokenLaunchObservation): TokenLaunchIngestResult {
  assertTimestamp(observation.observedAt)
  if (!observation.observationId || !observation.chainId || !observation.tokenAddress) throw new Error('Token launch observations require identity fields.')
  if (observation.initialLiquidityUsd !== undefined && !finite(observation.initialLiquidityUsd)) throw new Error('Initial liquidity must be a finite non-negative number.')
  const launchId = `launch:${observation.chainId}:${observation.tokenAddress}`
  const duplicate = seen.has(launchId)
  seen.add(launchId)
  const evidenceIds = [...new Set([observation.observationId, ...observation.evidenceIds])]
  const launch: TokenLaunch = { launchId, chainId: observation.chainId, tokenAddress: observation.tokenAddress, deployerWalletId: observation.deployerWalletId, launchedAt: observation.observedAt, launchpad: observation.launchpad, initialLiquidityUsd: observation.initialLiquidityUsd, outcome: 'UNKNOWN', evidenceIds }
  const graph = deriveTokenActorGraph({ chainId: observation.chainId, tokenAddress: observation.tokenAddress, observedAt: observation.observedAt, deployerWalletId: observation.deployerWalletId, funderWalletIds: observation.funderWalletIds, liquidityProviderWalletIds: observation.liquidityProviderWalletIds, earlyBuyerWalletIds: observation.earlyBuyerWalletIds, evidenceIds })
  return { launch, graph, duplicate }
}

export function resetTokenLaunchIngestForTests(): void { seen.clear() }

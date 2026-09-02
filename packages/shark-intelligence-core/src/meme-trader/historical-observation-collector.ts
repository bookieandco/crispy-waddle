import type { TokenLaunch } from './wallet-launch-pipeline'
import { buildHistoricalObservation, type ActorMovement, type HistoricalCandle, type HistoricalHolderPoint } from './historical-observation-backfill'
import type { CoinGeckoHistoricalSource } from './coingecko-historical-source'
import type { HeliusHistoricalSource } from './helius-historical-source'

export type HistoricalCollectionResult = {
  launchId: string
  observation: ReturnType<typeof buildHistoricalObservation>
  sourceStatus: { market: 'complete' | 'missing' | 'error'; holders: 'complete' | 'missing' | 'error'; actors: 'complete' | 'missing' | 'error' }
  errors: string[]
}

/** Collects historical evidence without converting unavailable data into positive evidence. */
export async function collectHistoricalObservation(input: {
  launch: TokenLaunch
  market: CoinGeckoHistoricalSource
  actors?: HeliusHistoricalSource
  now?: string
}): Promise<HistoricalCollectionResult> {
  const now = input.now ?? new Date().toISOString()
  const errors: string[] = []
  let candles: HistoricalCandle[] = []
  let holders: HistoricalHolderPoint[] = []
  let movements: ActorMovement[] = []
  let market: HistoricalCollectionResult['sourceStatus']['market'] = 'missing'
  let holderStatus: HistoricalCollectionResult['sourceStatus']['holders'] = 'missing'
  let actorStatus: HistoricalCollectionResult['sourceStatus']['actors'] = 'missing'

  try { candles = await input.market.candles(input.launch); market = candles.length ? 'complete' : 'missing' } catch { market = 'error'; errors.push('market-history-source-failed') }
  try { holders = await input.market.holderHistory(input.launch); holderStatus = holders.length ? 'complete' : 'missing' } catch { holderStatus = 'error'; errors.push('holder-history-source-failed') }
  if (input.actors) {
    try { movements = await input.actors.deployerTransfers(input.launch); actorStatus = movements.length ? 'complete' : 'missing' } catch { actorStatus = 'error'; errors.push('actor-history-source-failed') }
  }

  return { launchId: input.launch.launchId, observation: buildHistoricalObservation({ launch: input.launch, candles, holders, movements, now }), sourceStatus: { market, holders: holderStatus, actors: actorStatus }, errors }
}

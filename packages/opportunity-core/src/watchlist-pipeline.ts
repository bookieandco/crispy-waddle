import type { AlertEventRepository, WatchlistRepository } from './repositories.js'
import {
  createAlertEvent,
  type AlertEvent,
  type WatchlistEntry,
  type WatchlistEvaluation,
} from './domain/watchlist.js'

export type WatchlistAlertPipelineResult = {
  event: AlertEvent
  created: boolean
}

/**
 * Application-neutral 6.74 orchestration boundary.
 * Evaluations are produced by the intelligence/ranking layers; this service
 * is responsible only for turning an evaluation into a durable, deduplicated
 * alert event. No transport or notification side effects happen here.
 */
export class WatchlistAlertPipeline {
  constructor(
    private readonly watchlists: WatchlistRepository,
    private readonly alerts: AlertEventRepository,
    private readonly engineVersion = '6.74.0',
  ) {}

  async evaluateAndPersist(
    watchlistEntryId: string,
    evaluation: WatchlistEvaluation,
    detectedAt: string,
  ): Promise<WatchlistAlertPipelineResult> {
    const entry = await this.watchlists.get(watchlistEntryId)
    if (!entry) throw new Error(`Unknown watchlist entry: ${watchlistEntryId}`)
    if (!entry.enabled) throw new Error(`Watchlist entry is disabled: ${watchlistEntryId}`)

    const event = createAlertEvent(entry, evaluation, detectedAt, this.engineVersion)
    return this.alerts.saveIfAbsent(event)
  }
}

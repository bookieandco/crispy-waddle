import type { GrowthId } from '../domain/types.js';
import type { DistributionOpportunity } from './distribution-opportunity.js';
import { bridgeTikTokTrends, type TikTokDistributionBridgeResult, type TikTokTrendSignal } from './tiktok-distribution-bridge.js';
import type { TikTokTrendProvider, TikTokTrendQuery } from './tiktok-trend-provider.js';

export interface TikTokOpportunityCandidate {
  opportunity: DistributionOpportunity;
  signal: TikTokDistributionBridgeResult['signal'];
  score: TikTokDistributionBridgeResult['score'];
}

export interface TikTokOpportunityRun {
  runId: GrowthId;
  query: TikTokTrendQuery;
  discovered: number;
  candidates: readonly TikTokOpportunityCandidate[];
}

export interface TikTokOpportunityEngineOptions {
  provider: TikTokTrendProvider;
  /** Minimum score required for an opportunity to enter the experiment queue. */
  minimumScore?: number;
  /** Maximum candidates returned to downstream planning. */
  maxCandidates?: number;
}

/**
 * Executes the provider -> normalization -> scoring -> opportunity boundary.
 * No publishing or spending occurs here; downstream experiment planning owns
 * those actions and can require a separate approval/policy gate.
 */
export async function discoverTikTokOpportunities(
  query: TikTokTrendQuery,
  options: TikTokOpportunityEngineOptions,
): Promise<TikTokOpportunityRun> {
  const minimumScore = Math.max(0, Math.min(100, options.minimumScore ?? 50));
  const maxCandidates = Math.max(1, options.maxCandidates ?? 20);
  const signals = await options.provider.discoverTrends(query);
  const bridged = bridgeTikTokTrends(signals);
  const candidates = bridged
    .filter((item) => item.score.score >= minimumScore && item.score.recommendation !== 'stop')
    .slice(0, maxCandidates)
    .map(({ opportunity, signal, score }) => ({ opportunity, signal, score }));

  return {
    runId: `growth-run:tiktok:${Date.now()}` as GrowthId,
    query,
    discovered: signals.length,
    candidates,
  };
}

export function rankTikTokOpportunitySignals(signals: readonly TikTokTrendSignal[]): TikTokOpportunityCandidate[] {
  return bridgeTikTokTrends(signals).map(({ opportunity, signal, score }) => ({ opportunity, signal, score }));
}

import type { PerformanceAggregate } from '../attribution/performance-aggregator.js';
import { summarizeFunnel, type FunnelEvent, type FunnelSummary } from '../attribution/funnel-events.js';
import { assessContentPerformance, type ContentAssessment, type ContentPerformance } from './content-performance.js';
import { runGrowthIntelligenceLoop, type GrowthLoopResult } from './growth-loop.js';

export interface ContentGrowthLoopInput {
  content: readonly ContentPerformance[];
  funnelEvents: readonly FunnelEvent[];
  aggregates: readonly PerformanceAggregate[];
}

export interface ContentGrowthAction {
  assetId: ContentPerformance['assetId'];
  platform: string;
  action: ContentAssessment['verdict'];
  priority: number;
  reasons: readonly string[];
}

export interface ContentGrowthLoopResult extends GrowthLoopResult {
  assessments: ContentAssessment[];
  funnel: FunnelSummary;
  actions: ContentGrowthAction[];
}

/**
 * Application-level bridge between content telemetry, the revenue funnel,
 * and the existing Growth Core intelligence loop.
 *
 * This deliberately keeps policy deterministic: low-volume assets are held,
 * while strong assets can be surfaced for scaling. The existing growth loop
 * remains responsible for economic opportunities and experiment planning.
 */
export function runContentGrowthLoop(input: ContentGrowthLoopInput): ContentGrowthLoopResult {
  const assessments = input.content.map(assessContentPerformance);
  const funnel = summarizeFunnel(input.funnelEvents);
  const growth = runGrowthIntelligenceLoop(input.aggregates);

  const actions = assessments
    .map((assessment) => {
      const funnelWeight = funnel.purchases > 0 || funnel.leads > 0 ? 1.1 : 1;
      const verdictWeight = { scale: 1, iterate: 0.75, hold: 0.35, stop: 0.1 }[assessment.verdict];
      return {
        assetId: assessment.assetId,
        platform: assessment.platform,
        action: assessment.verdict,
        priority: Number((assessment.score * verdictWeight * funnelWeight).toFixed(4)),
        reasons: assessment.reasons,
      };
    })
    .sort((a, b) => b.priority - a.priority);

  return { ...growth, assessments, funnel, actions };
}

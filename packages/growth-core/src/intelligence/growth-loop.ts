import type { PerformanceAggregate } from '../attribution/performance-aggregator.js';
import { buildGrowthDecisionFeed, type GrowthDecision } from './growth-decision-feed.js';
import { rankGrowthOpportunities, type GrowthOpportunity } from './opportunity-engine.js';
import { planGrowthExperiment, type ExperimentPlan } from './experiment-planner.js';

export interface GrowthLoopResult {
  decisions: GrowthDecision[];
  opportunities: GrowthOpportunity[];
  experiments: ExperimentPlan[];
}

export function runGrowthIntelligenceLoop(
  aggregates: readonly PerformanceAggregate[],
): GrowthLoopResult {
  const decisions = buildGrowthDecisionFeed(aggregates);
  const opportunities = rankGrowthOpportunities(decisions);
  const experiments = opportunities
    .filter((opportunity) => opportunity.action === 'scale' || opportunity.action === 'test')
    .map(planGrowthExperiment);

  return { decisions, opportunities, experiments };
}

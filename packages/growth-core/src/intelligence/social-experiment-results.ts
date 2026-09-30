import type { GrowthId } from '../domain/types.js';
import type { SocialKnowledgeRecord } from './social-knowledge.js';

export interface SocialExperimentResult {
  readonly experimentId: GrowthId;
  readonly creativePackId: GrowthId;
  readonly platform: string;
  readonly topic: string;
  readonly observedAt: string;
  readonly impressions: number;
  readonly clicks: number;
  readonly conversions: number;
  readonly revenue: number;
  readonly spend: number;
  readonly evidence: readonly GrowthId[];
}

export interface SocialExperimentOutcome {
  readonly experimentId: GrowthId;
  readonly ctr: number;
  readonly conversionRate: number;
  readonly roas: number | null;
  readonly commercialValue: number;
  readonly knowledge: SocialKnowledgeRecord;
}

const safeRate = (numerator: number, denominator: number) => denominator > 0 ? numerator / denominator : 0;

export function ingestSocialExperimentResult(result: SocialExperimentResult): SocialExperimentOutcome {
  const impressions = Math.max(0, result.impressions);
  const clicks = Math.max(0, result.clicks);
  const conversions = Math.max(0, result.conversions);
  const revenue = Math.max(0, result.revenue);
  const spend = Math.max(0, result.spend);
  const ctr = safeRate(clicks, impressions);
  const conversionRate = safeRate(conversions, clicks);
  const roas = spend > 0 ? revenue / spend : null;
  const commercialValue = spend > 0 ? Math.max(-1, Math.min(10, (revenue - spend) / spend)) : Math.min(10, revenue / 100);

  return {
    experimentId: result.experimentId,
    ctr,
    conversionRate,
    roas,
    commercialValue,
    knowledge: {
      id: `experiment-result:${result.experimentId}:${result.observedAt}` as GrowthId,
      topic: result.topic,
      platform: result.platform as never,
      observedAt: result.observedAt,
      signalType: 'experiment',
      value: commercialValue,
      confidence: Math.min(1, Math.log10(Math.max(1, impressions)) / 6),
      evidence: [...new Set([result.experimentId, result.creativePackId, ...result.evidence])],
    },
  };
}

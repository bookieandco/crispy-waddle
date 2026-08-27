import type { GrowthId } from '../domain/types.js';

export interface ContentPerformance {
  assetId: GrowthId;
  platform: string;
  impressions: number;
  views: number;
  twoSecondViewRate?: number;
  averageWatchSeconds?: number;
  completionRate?: number;
  ctr?: number;
  saves?: number;
  comments?: number;
  shares?: number;
  leads?: number;
  purchases?: number;
  spend?: number;
  revenue?: number;
}

export type ContentVerdict = 'scale' | 'iterate' | 'hold' | 'stop';

export interface ContentAssessment {
  assetId: GrowthId;
  platform: string;
  verdict: ContentVerdict;
  score: number;
  reasons: string[];
}

const clamp = (value: number): number => Math.max(0, Math.min(1, value));

export function assessContentPerformance(input: ContentPerformance): ContentAssessment {
  const ctr = clamp((input.ctr ?? 0) / 0.02);
  const hold = clamp((input.completionRate ?? (
    input.averageWatchSeconds && input.averageWatchSeconds > 0 && input.twoSecondViewRate
      ? input.twoSecondViewRate * 0.5
      : 0
  )) / 0.33);
  const engagement = clamp(((input.saves ?? 0) + (input.shares ?? 0)) / Math.max(input.impressions, 1) / 0.05);
  const conversion = clamp((input.leads ?? 0) / Math.max(input.views, 1) / 0.05);
  const revenueEfficiency = input.spend && input.spend > 0
    ? clamp((input.revenue ?? 0) / input.spend / 3)
    : conversion;
  const score = Number((ctr * 0.25 + hold * 0.3 + engagement * 0.15 + conversion * 0.15 + revenueEfficiency * 0.15).toFixed(4));

  const reasons: string[] = [];
  if (ctr >= 1) reasons.push('strong click-through');
  else if (input.ctr !== undefined && input.ctr < 0.01) reasons.push('weak click-through');
  if (hold >= 1) reasons.push('strong retention');
  else if (input.completionRate !== undefined && input.completionRate < 0.2) reasons.push('weak retention');
  if ((input.leads ?? 0) > 0) reasons.push('produces leads');
  if ((input.purchases ?? 0) > 0) reasons.push('produces purchases');

  const verdict: ContentVerdict = score >= 0.65
    ? 'scale'
    : score >= 0.4
      ? 'iterate'
      : input.impressions < 1000
        ? 'hold'
        : 'stop';

  return { assetId: input.assetId, platform: input.platform, verdict, score, reasons };
}

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

const clamp = (value: number | undefined, fallback = 0): number =>
  Math.max(0, Math.min(1, value ?? fallback));

export function assessContentPerformance(input: ContentPerformance): ContentAssessment {
  const ctr = clamp(input.ctr);
  const hold = clamp(input.completionRate ?? (
    input.averageWatchSeconds && input.averageWatchSeconds > 0 && input.twoSecondViewRate
      ? input.twoSecondViewRate * 0.5
      : undefined
  ));
  const engagement = clamp((input.saves ?? 0) / Math.max(input.impressions, 1) * 10);
  const conversion = clamp((input.leads ?? 0) / Math.max(input.views, 1) * 20);
  const revenueEfficiency = input.spend && input.spend > 0
    ? clamp((input.revenue ?? 0) / input.spend / 3)
    : conversion;
  const score = Number((ctr * 0.25 + hold * 0.3 + engagement * 0.15 + conversion * 0.15 + revenueEfficiency * 0.15).toFixed(4));

  const reasons: string[] = [];
  if (ctr >= 0.02) reasons.push('strong click-through');
  else if (ctr > 0 && ctr < 0.01) reasons.push('weak click-through');
  if (hold >= 0.33) reasons.push('strong retention');
  else if (input.completionRate !== undefined && hold < 0.2) reasons.push('weak retention');
  if (input.leads && input.leads > 0) reasons.push('produces leads');
  if (input.purchases && input.purchases > 0) reasons.push('produces purchases');

  const verdict: ContentVerdict = score >= 0.65
    ? 'scale'
    : score >= 0.4
      ? 'iterate'
      : input.impressions < 1000
        ? 'hold'
        : 'stop';

  return { assetId: input.assetId, platform: input.platform, verdict, score, reasons };
}

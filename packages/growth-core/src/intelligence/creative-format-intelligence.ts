import type { GrowthId } from '../domain/types.js';

export type CreativeSignalKind =
  | 'hook'
  | 'opening'
  | 'problem'
  | 'proof'
  | 'pacing'
  | 'cta'
  | 'format'
  | 'audience'
  | 'offer';

export interface CreativePerformanceEvidence {
  id: GrowthId;
  variantId: GrowthId;
  platform: string;
  publishedAt: string;
  impressions?: number;
  views?: number;
  completionRate?: number;
  replayRate?: number;
  saves?: number;
  comments?: number;
  clicks?: number;
  conversions?: number;
  revenue?: number;
}

export interface CreativePattern {
  id: GrowthId;
  name: string;
  signals: Readonly<Record<CreativeSignalKind, string>>;
  evidenceIds: readonly GrowthId[];
  repeatabilityScore: number;
  confidence: number;
}

export interface CreativeFormatAssessment {
  variantId: GrowthId;
  score: number;
  evidenceCount: number;
  strengths: readonly string[];
  weaknesses: readonly string[];
  recommendation: 'promote' | 'iterate' | 'archive';
}

const clamp = (value: number): number => Math.max(0, Math.min(100, value));

export function assessCreativePerformance(
  evidence: readonly CreativePerformanceEvidence[],
): CreativeFormatAssessment[] {
  const byVariant = new Map<GrowthId, CreativePerformanceEvidence[]>();
  for (const item of evidence) {
    const current = byVariant.get(item.variantId) ?? [];
    current.push(item);
    byVariant.set(item.variantId, current);
  }

  return [...byVariant.entries()].map(([variantId, items]) => {
    const completion = average(items.map((x) => x.completionRate));
    const replay = average(items.map((x) => x.replayRate));
    const clickRate = average(items.map((x) => rate(x.clicks, x.impressions ?? x.views)));
    const conversionRate = average(items.map((x) => rate(x.conversions, x.clicks)));
    const score = clamp(
      completion * 35 + replay * 20 + clickRate * 25 + conversionRate * 20,
    );

    const strengths: string[] = [];
    const weaknesses: string[] = [];
    if (completion >= 0.35) strengths.push('strong completion');
    if (replay >= 0.05) strengths.push('replay signal');
    if (clickRate >= 0.01) strengths.push('click-through signal');
    if (conversionRate >= 0.02) strengths.push('conversion signal');
    if (completion < 0.2) weaknesses.push('weak completion');
    if (clickRate < 0.005) weaknesses.push('weak click-through');
    if (conversionRate < 0.01) weaknesses.push('weak conversion');

    return {
      variantId,
      score,
      evidenceCount: items.length,
      strengths,
      weaknesses,
      recommendation: score >= 65 ? 'promote' : score >= 40 ? 'iterate' : 'archive',
    };
  });
}

export function discoverCreativePattern(
  name: string,
  signals: Record<CreativeSignalKind, string>,
  evidence: readonly CreativePerformanceEvidence[],
): CreativePattern {
  const assessments = assessCreativePerformance(evidence);
  const promoted = assessments.filter((x) => x.recommendation === 'promote').length;
  const repeatabilityScore = clamp(
    assessments.length === 0 ? 0 : (promoted / assessments.length) * 100,
  );
  const confidence = clamp(
    Math.min(100, evidence.length * 20) * (repeatabilityScore / 100),
  );

  return {
    id: `creative-pattern:${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    name,
    signals,
    evidenceIds: evidence.map((x) => x.id),
    repeatabilityScore,
    confidence,
  };
}

export function generateControlledVariants(
  pattern: CreativePattern,
  variantCount = 3,
): string[] {
  const count = Math.max(1, Math.min(10, Math.floor(variantCount)));
  return Array.from({ length: count }, (_, index) =>
    `${pattern.id}:variant-${index + 1}`,
  );
}

function average(values: readonly (number | undefined)[]): number {
  const present = values.filter((value): value is number => value !== undefined && Number.isFinite(value));
  return present.length === 0 ? 0 : present.reduce((sum, value) => sum + value, 0) / present.length;
}

function rate(numerator?: number, denominator?: number): number {
  if (numerator === undefined || denominator === undefined || denominator <= 0) return 0;
  return numerator / denominator;
}

import type { VentureOpportunity } from '@jhadina/opportunity-core';
import type { GrowthId } from '../domain/types.js';
import { getGrowthBrand } from './brand-registry.js';
import type {
  SocialPortfolioObjective,
  SocialPortfolioSubject,
} from './social-juggernaut.js';

export interface BusinessFactorySocialInput {
  venture: Pick<
    VentureOpportunity,
    | 'id'
    | 'title'
    | 'lifecycle'
    | 'demandThesis'
    | 'score'
    | 'makeSenseVote'
    | 'riskFlags'
    | 'evidenceRefs'
  >;
  brandId: GrowthId;
  objectives: readonly SocialPortfolioObjective[];
  preferredSurfaces?: readonly string[];
  contentReadiness: number;
  urgency: number;
  validatedWinningMechanic?: Readonly<{
    id: string;
    evidenceRefs: readonly string[];
  }>;
}

export function businessFactoryVentureToSocialSubject(
  input: BusinessFactorySocialInput,
): SocialPortfolioSubject {
  const brand = getGrowthBrand(input.brandId);
  const surfaces = unique([
    ...(input.preferredSurfaces ?? []),
    ...(brand?.preferredSurfaces ?? []),
  ]);

  if (!surfaces.some((surface) => surface.startsWith('social:'))) {
    throw new Error('SOCIAL_JUGGERNAUT_BUSINESS_SOCIAL_SURFACE_REQUIRED');
  }
  if (!input.objectives.length) {
    throw new Error('SOCIAL_JUGGERNAUT_BUSINESS_OBJECTIVE_REQUIRED');
  }

  assertScore(input.contentReadiness, 'contentReadiness');
  assertScore(input.urgency, 'urgency');

  const thesis = input.venture.demandThesis;
  const audienceSignals = unique([
    thesis.buyer,
    thesis.jobToBeDone,
    thesis.paidProblem,
    ...thesis.unmetAngles,
    ...(brand?.audienceSignals ?? []),
  ]);

  const factors = input.venture.score.factors;
  const businessValue = round((
    factors.demandProof
      + factors.grossMarginPotential
      + factors.repeatability
  ) / 3);
  const evidenceQuality = round((
    input.venture.makeSenseVote.evidenceQuality
      + input.venture.makeSenseVote.overall
  ) / 2);
  const learningValue = round((
    factors.timeToEvidence
      + factors.crossJhadinaLeverage
      + factors.differentiation
  ) / 3);

  const lifecycleEvidence = `venture-lifecycle:${input.venture.lifecycle}`;
  const riskEvidence = input.venture.riskFlags.map((flag) => `venture-risk:${flag}`);

  return Object.freeze({
    id: `social-subject:${input.venture.id}` as GrowthId,
    kind: 'venture' as const,
    brandId: input.brandId,
    label: input.venture.title,
    audienceSignals: Object.freeze(audienceSignals),
    objectives: Object.freeze([...input.objectives]),
    preferredSurfaces: Object.freeze(surfaces),
    evidenceRefs: Object.freeze(unique([
      ...input.venture.evidenceRefs,
      ...thesis.evidenceRefs,
      ...input.venture.score.evidenceRefs,
      ...input.venture.makeSenseVote.evidenceRefs,
      lifecycleEvidence,
      ...riskEvidence,
    ])),
    scores: Object.freeze({
      businessValue,
      evidenceQuality,
      contentReadiness: input.contentReadiness,
      learningValue,
      urgency: input.urgency,
    }),
    ...(input.validatedWinningMechanic
      ? {
          validatedWinningMechanic: Object.freeze({
            id: input.validatedWinningMechanic.id,
            evidenceRefs: Object.freeze(unique(
              input.validatedWinningMechanic.evidenceRefs,
            )),
          }),
        }
      : {}),
  });
}

function assertScore(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(`SOCIAL_JUGGERNAUT_BUSINESS_SCORE_INVALID:${name}`);
  }
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

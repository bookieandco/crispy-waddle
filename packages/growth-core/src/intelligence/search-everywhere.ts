import type { GrowthId } from '../domain/types.js';

export type DiscoverySurface = 'google' | 'social_search' | 'youtube' | 'community' | 'ai_answer';

export interface BuyerQuestion {
  id: GrowthId;
  question: string;
  intent: 'informational' | 'commercial' | 'transactional' | 'navigational';
  audienceSignals: readonly string[];
  priority: number;
}

export interface CoreAnswer {
  id: GrowthId;
  brandId: GrowthId;
  topic: string;
  thesis: string;
  evidence: readonly string[];
  sourceAssetId?: GrowthId;
}

export interface SurfaceAnswer {
  id: GrowthId;
  coreAnswerId: GrowthId;
  surface: DiscoverySurface;
  format: string;
  titleOrHook: string;
  body: string;
  cta?: string;
  queryTargets: readonly string[];
}

export interface SearchEverywherePlan {
  id: GrowthId;
  brandId: GrowthId;
  question: BuyerQuestion;
  coreAnswer: CoreAnswer;
  surfaces: readonly SurfaceAnswer[];
  consistencySignals: readonly string[];
}

const surfaceFormats: Record<DiscoverySurface, string> = {
  google: 'answer-led page',
  social_search: 'short-form answer post',
  youtube: 'answer video',
  community: 'evidence-led discussion answer',
  ai_answer: 'citation-ready authoritative answer',
};

export function buildSearchEverywherePlan(input: {
  id?: GrowthId;
  brandId: GrowthId;
  question: BuyerQuestion;
  coreAnswer: CoreAnswer;
  surfaces?: readonly DiscoverySurface[];
}): SearchEverywherePlan {
  const surfaces = input.surfaces ?? ['google', 'social_search', 'youtube', 'community', 'ai_answer'];
  const surfaceAnswers = surfaces.map((surface) => ({
    id: `${input.coreAnswer.id}:${surface}`,
    coreAnswerId: input.coreAnswer.id,
    surface,
    format: surfaceFormats[surface],
    titleOrHook: input.question.question,
    body: input.coreAnswer.thesis,
    cta: `Learn more about ${input.coreAnswer.topic}.`,
    queryTargets: [input.question.question, ...input.question.audienceSignals],
  }));

  return {
    id: input.id ?? `search-everywhere:${input.brandId}:${input.question.id}`,
    brandId: input.brandId,
    question: input.question,
    coreAnswer: input.coreAnswer,
    surfaces: surfaceAnswers,
    consistencySignals: [
      input.coreAnswer.topic,
      input.coreAnswer.thesis,
      ...input.coreAnswer.evidence,
    ],
  };
}

export function validateAnswerConsistency(plan: SearchEverywherePlan): {
  consistent: boolean;
  missingSurfaceIds: GrowthId[];
  mismatchedCoreAnswerIds: GrowthId[];
} {
  const missingSurfaceIds = plan.surfaces
    .filter((surface) => surface.coreAnswerId !== plan.coreAnswer.id)
    .map((surface) => surface.id);

  const mismatchedCoreAnswerIds = plan.surfaces
    .filter((surface) => !surface.body.includes(plan.coreAnswer.thesis))
    .map((surface) => surface.id);

  return {
    consistent: missingSurfaceIds.length === 0 && mismatchedCoreAnswerIds.length === 0,
    missingSurfaceIds,
    mismatchedCoreAnswerIds,
  };
}

import type { PersonalityState } from './types.js';

export interface IndependentView {
  traitId: string;
  dimension: 'opinion' | 'taste';
  stance: string;
  evidenceIds: readonly string[];
  confidence: number;
  differsFromUserPreference: boolean;
  source: 'governed-personality-trait';
}

/**
 * LIVE.6: read-only self-authorship expression from already ACCEPTED, governed
 * Personality evidence. A user preference is neither Jhadina's opinion nor
 * grounds to pretend she agrees. Does not create views or mutate state.
 */
export function readIndependentPersonalityView(
  state: PersonalityState,
  traitId: string,
  userPreference?: string,
): IndependentView | undefined {
  const trait = state.traits.find(item => item.id === traitId);
  if (!trait || !trait.statement.trim() || trait.status !== 'accepted' ||
      (trait.dimension !== 'opinion' && trait.dimension !== 'taste') ||
      !Number.isFinite(trait.confidence) || trait.confidence < 0.8 ||
      !Number.isFinite(trait.stability) || trait.stability < 0.7 ||
      trait.contradictions.length > 0) return undefined;
  const refs = trait.evidence.filter(ref =>
    ref.immutable === true && ref.id.trim() && ref.source.trim() &&
    Number.isFinite(Date.parse(ref.observedAt)),
  );
  const evidenceIds = [...new Set(refs.map(ref => ref.id))];
  if (evidenceIds.length < 3) return undefined;
  return {
    traitId: trait.id,
    dimension: trait.dimension,
    stance: trait.statement,
    evidenceIds,
    confidence: trait.confidence,
    differsFromUserPreference: Boolean(userPreference?.trim() &&
      userPreference.trim().toLowerCase() !== trait.statement.trim().toLowerCase()),
    source: 'governed-personality-trait',
  };
}

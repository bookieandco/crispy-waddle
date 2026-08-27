import type { GrowthId } from '../domain/types.js';
import type { KnowledgeClaim, KnowledgeFragment, KnowledgeSource } from './knowledge-core.js';

export interface OpportunityEvidence {
  id: GrowthId;
  opportunityId: GrowthId;
  sourceIds: readonly GrowthId[];
  fragmentIds: readonly GrowthId[];
  claimIds: readonly GrowthId[];
  evidenceScore: number;
  rationale: string;
}

export function buildOpportunityEvidence(input: {
  id: GrowthId;
  opportunityId: GrowthId;
  sources: readonly KnowledgeSource[];
  fragments: readonly KnowledgeFragment[];
  claims: readonly KnowledgeClaim[];
}): OpportunityEvidence {
  const fragmentIds = new Set(input.fragments.map((fragment) => fragment.id));
  const claims = input.claims.filter((claim) => claim.fragmentIds.some((id) => fragmentIds.has(id)));
  const sourceIds = new Set(
    input.fragments
      .filter((fragment) => fragmentIds.has(fragment.id))
      .map((fragment) => fragment.sourceId),
  );
  const strength = { weak: 0.25, moderate: 0.5, strong: 0.75, verified: 1 } as const;
  const evidenceScore = claims.length === 0
    ? 0
    : Math.round(
        (claims.reduce((sum, claim) => sum + strength[claim.evidenceStrength] * claim.confidence, 0) /
          claims.length) *
          100,
      );

  return {
    id: input.id,
    opportunityId: input.opportunityId,
    sourceIds: [...sourceIds].filter((id) => input.sources.some((source) => source.id === id)),
    fragmentIds: input.fragments.map((fragment) => fragment.id),
    claimIds: claims.map((claim) => claim.id),
    evidenceScore,
    rationale:
      claims.length === 0
        ? 'No linked claims; opportunity requires evidence before promotion.'
        : `${claims.length} evidence-backed claim(s) support this opportunity with a ${evidenceScore}/100 evidence score.`,
  };
}

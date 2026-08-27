import type { GrowthId, ISODateTime } from '../domain/types.js';

export type KnowledgeSourceKind =
  | 'web'
  | 'social'
  | 'video'
  | 'community'
  | 'research'
  | 'review'
  | 'advertisement'
  | 'internal';

export type EvidenceStrength = 'weak' | 'moderate' | 'strong' | 'verified';

export interface KnowledgeSource {
  id: GrowthId;
  kind: KnowledgeSourceKind;
  title: string;
  uri?: string;
  publisher?: string;
  author?: string;
  publishedAt?: ISODateTime;
  capturedAt: ISODateTime;
  checksum?: string;
}

export interface KnowledgeFragment {
  id: GrowthId;
  sourceId: GrowthId;
  text: string;
  startOffset?: number;
  endOffset?: number;
  capturedAt: ISODateTime;
  tags: readonly string[];
}

export interface KnowledgeClaim {
  id: GrowthId;
  fragmentIds: readonly GrowthId[];
  claim: string;
  evidenceStrength: EvidenceStrength;
  confidence: number;
  contradictedByClaimIds: readonly GrowthId[];
}

export interface KnowledgeConcept {
  id: GrowthId;
  label: string;
  description?: string;
  relatedConceptIds: readonly GrowthId[];
  claimIds: readonly GrowthId[];
}

export interface BuyerQuestionSignal {
  question: string;
  sourceFragmentIds: readonly GrowthId[];
  intent: 'informational' | 'commercial' | 'transactional' | 'navigational';
  frequency: number;
  priority: number;
}

export interface KnowledgeResearchNode {
  id: GrowthId;
  question: string;
  parentId?: GrowthId;
  sourceFragmentIds: readonly GrowthId[];
  claimIds: readonly GrowthId[];
  childIds: readonly GrowthId[];
}

export interface KnowledgeResearchTree {
  id: GrowthId;
  rootQuestion: string;
  nodes: readonly KnowledgeResearchNode[];
}

export function buildKnowledgeResearchTree(input: {
  id: GrowthId;
  rootQuestion: string;
  questions: readonly BuyerQuestionSignal[];
  fragmentIds?: readonly GrowthId[];
}): KnowledgeResearchTree {
  const root: KnowledgeResearchNode = {
    id: `${input.id}:root`,
    question: input.rootQuestion,
    sourceFragmentIds: input.fragmentIds ?? [],
    claimIds: [],
    childIds: input.questions.map((_, index) => `${input.id}:q:${index}`),
  };

  const nodes = input.questions.map((question, index): KnowledgeResearchNode => ({
    id: `${input.id}:q:${index}`,
    question: question.question,
    parentId: root.id,
    sourceFragmentIds: question.sourceFragmentIds,
    claimIds: [],
    childIds: [],
  }));

  return { id: input.id, rootQuestion: input.rootQuestion, nodes: [root, ...nodes] };
}

export function scoreEvidence(claims: readonly KnowledgeClaim[]): number {
  if (claims.length === 0) return 0;
  const weighted = claims.reduce((sum, claim) => {
    const strength = { weak: 0.25, moderate: 0.5, strong: 0.75, verified: 1 }[claim.evidenceStrength];
    return sum + strength * Math.max(0, Math.min(1, claim.confidence));
  }, 0);
  return Math.round((weighted / claims.length) * 100);
}

import type { GrowthId, ISODateTime, Provenance } from '../domain/types.js';

export type KnowledgeSourceKind = 'web' | 'social' | 'video' | 'document' | 'review' | 'market_data' | 'internal';

export interface KnowledgeInput {
  id: GrowthId;
  sourceKind: KnowledgeSourceKind;
  sourceUri?: string;
  title?: string;
  text: string;
  capturedAt: ISODateTime;
  provenance: Provenance;
  metadata?: Record<string, string | number | boolean>;
}

export interface KnowledgeFragmentInput {
  id: GrowthId;
  sourceId: GrowthId;
  text: string;
  startOffset?: number;
  endOffset?: number;
}

export interface ExtractedClaim {
  id: GrowthId;
  fragmentId: GrowthId;
  claim: string;
  claimType: 'fact' | 'opinion' | 'metric' | 'trend' | 'instruction' | 'comparison';
  confidence: number;
  evidenceStrength: number;
}

export function normalizeKnowledgeInput(input: KnowledgeInput): KnowledgeInput {
  return {
    ...input,
    title: input.title?.trim() || undefined,
    text: input.text.trim(),
  };
}

export function scoreClaimEvidence(claim: Pick<ExtractedClaim, 'evidenceStrength' | 'confidence'>): number {
  const evidence = Math.max(0, Math.min(1, claim.evidenceStrength));
  const confidence = Math.max(0, Math.min(1, claim.confidence));
  return Number((evidence * confidence).toFixed(4));
}

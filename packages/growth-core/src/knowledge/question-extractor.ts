import type { GrowthId } from '../domain/types.js';
import type { ExtractedClaim } from './ingestion.js';

export interface BuyerQuestionCandidate {
  id: GrowthId;
  question: string;
  sourceClaimIds: GrowthId[];
  intent: 'discovery' | 'comparison' | 'validation' | 'purchase' | 'how_to';
  confidence: number;
}

export function deriveBuyerQuestion(claim: ExtractedClaim): BuyerQuestionCandidate | null {
  const text = claim.claim.trim();
  if (!text) return null;

  const intent = claim.claimType === 'comparison'
    ? 'comparison'
    : claim.claimType === 'instruction'
      ? 'how_to'
      : claim.claimType === 'metric'
        ? 'validation'
        : 'discovery';

  return {
    id: `buyer-question:${claim.id}`,
    question: `What should I know about ${text.replace(/[.!?]+$/, '')}?`,
    sourceClaimIds: [claim.id],
    intent,
    confidence: Math.max(0, Math.min(1, claim.confidence)),
  };
}

export function deriveBuyerQuestions(claims: readonly ExtractedClaim[]): BuyerQuestionCandidate[] {
  return claims.flatMap((claim) => {
    const candidate = deriveBuyerQuestion(claim);
    return candidate ? [candidate] : [];
  });
}

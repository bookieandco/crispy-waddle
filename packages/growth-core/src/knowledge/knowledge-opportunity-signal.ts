import type { GrowthId } from '../domain/types.js';
import type { BuyerQuestionCandidate } from './question-extractor.js';
import type { ExtractedClaim } from './ingestion.js';

export interface KnowledgeOpportunitySignal {
  id: GrowthId;
  key: string;
  question: string;
  intent: BuyerQuestionCandidate['intent'];
  evidenceScore: number;
  confidence: number;
  sourceClaimIds: GrowthId[];
  recommendedTests: string[];
}

export function buildKnowledgeOpportunitySignals(
  claims: readonly ExtractedClaim[],
  questions: readonly BuyerQuestionCandidate[],
): KnowledgeOpportunitySignal[] {
  const byId = new Map(claims.map((claim) => [claim.id, claim]));

  return questions.map((question) => {
    const evidenceScore = question.sourceClaimIds.reduce((best, claimId) => {
      const claim = byId.get(claimId);
      if (!claim) return best;
      return Math.max(best, claim.evidenceStrength * claim.confidence);
    }, 0);

    const recommendedTests = question.intent === 'comparison'
      ? ['comparison_creative', 'objection_hook', 'proof_asset']
      : question.intent === 'validation'
        ? ['proof_creative', 'testimonial', 'case_study']
        : question.intent === 'purchase'
          ? ['offer_hook', 'direct_response', 'comment_to_dm']
          : question.intent === 'how_to'
            ? ['tutorial', 'checklist', 'short_form_answer']
            : ['question_hook', 'educational_short', 'search_answer'];

    return {
      id: `knowledge-opportunity:${question.id}`,
      key: `knowledge:${question.intent}:${question.id}`,
      question: question.question,
      intent: question.intent,
      evidenceScore: Number(evidenceScore.toFixed(4)),
      confidence: question.confidence,
      sourceClaimIds: [...question.sourceClaimIds],
      recommendedTests,
    };
  });
}

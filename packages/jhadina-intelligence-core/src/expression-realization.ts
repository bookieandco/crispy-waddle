import type { DecisionProposal, ExpressionDirective } from '@jhadina/core-spine';

export interface GovernedExpressionRealization {
  /** Semantic model output. Never rewritten into policy or personality state. */
  proposal: DecisionProposal;
  /** Deterministic presentation assets copied only from the governed directive. */
  presentation: {
    mode: ExpressionDirective['mode'];
    allowProfanity: boolean;
    allowQuip: boolean;
    callback?: string;
    culturalReference?: string;
  };
}

/**
 * Separates model-authored semantics from deterministic expression assets.
 *
 * The LLM may produce recommendation/rationale text, but callback and cultural
 * reference values can enter the presentation layer only by being copied from
 * the already-governed ExpressionDirective. No model-returned field is ever
 * consulted for these assets.
 */
export function realizeGovernedExpression(
  proposal: DecisionProposal,
  directive?: ExpressionDirective,
): GovernedExpressionRealization {
  return Object.freeze({
    proposal,
    presentation: Object.freeze({
      mode: directive?.mode ?? 'explanatory',
      allowProfanity: directive?.allowProfanity ?? false,
      allowQuip: directive?.allowQuip ?? false,
      ...(directive?.callback ? { callback: directive.callback } : {}),
      ...(directive?.culturalReference ? { culturalReference: directive.culturalReference } : {}),
    }),
  });
}

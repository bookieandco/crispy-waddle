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
  /** Ordered render segments. Governed assets are separate from model prose. */
  segments: readonly GovernedExpressionSegment[];
}

export type GovernedExpressionSegment =
  | { kind: 'semantic'; text: string }
  | { kind: 'callback'; text: string }
  | { kind: 'cultural_reference'; text: string };

/**
 * Separates model-authored semantics from deterministic expression assets.
 *
 * The LLM owns semantic prose only. Verified callbacks/cultural references are
 * appended as distinct render segments copied from ExpressionDirective. This
 * avoids asking the model to paraphrase or "naturally weave in" a governed
 * asset, which would reopen the invention boundary.
 */
export function realizeGovernedExpression(
  proposal: DecisionProposal,
  directive?: ExpressionDirective,
): GovernedExpressionRealization {
  const presentation = Object.freeze({
    mode: directive?.mode ?? 'explanatory',
    allowProfanity: directive?.allowProfanity ?? false,
    allowQuip: directive?.allowQuip ?? false,
    ...(directive?.callback ? { callback: directive.callback } : {}),
    ...(directive?.culturalReference ? { culturalReference: directive.culturalReference } : {}),
  });

  const segments: GovernedExpressionSegment[] = [
    { kind: 'semantic', text: proposal.recommendation },
  ];
  if (presentation.callback) segments.push({ kind: 'callback', text: presentation.callback });
  if (presentation.culturalReference) {
    segments.push({ kind: 'cultural_reference', text: presentation.culturalReference });
  }

  return Object.freeze({
    proposal,
    presentation,
    segments: Object.freeze(segments.map((segment) => Object.freeze({ ...segment }))),
  });
}

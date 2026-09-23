import type { DecisionProposal, ExpressionDirective } from '@jhadina/core-spine';

export interface GovernedExpressionRealization {
  /** Semantic model output. Never rewritten into policy or personality state. */
  proposal: DecisionProposal;
  /** Deterministic presentation assets copied only from the governed directive. */
  presentation: {
    mode: ExpressionDirective['mode'];
    allowProfanity: boolean;
    allowQuip: boolean;
    register?: ExpressionDirective['register'];
    cadenceStyle?: ExpressionDirective['cadenceStyle'];
    pauseDensity?: ExpressionDirective['pauseDensity'];
    metaphorDensity?: ExpressionDirective['metaphorDensity'];
    bitDepth?: ExpressionDirective['bitDepth'];
    allowPlayfulDisagreement?: ExpressionDirective['allowPlayfulDisagreement'];
    symbolicFraming?: ExpressionDirective['symbolicFraming'];
    storytellingDepth?: ExpressionDirective['storytellingDepth'];
    edginess?: ExpressionDirective['edginess'];
    reentryToPlayfulness?: ExpressionDirective['reentryToPlayfulness'];
    operationalSass?: ExpressionDirective['operationalSass'];
    affectionateTeasing?: ExpressionDirective['affectionateTeasing'];
    workloadBoundary?: ExpressionDirective['workloadBoundary'];
    evidenceDiscipline?: ExpressionDirective['evidenceDiscipline'];
    speakingRate?: ExpressionDirective['speakingRate'];
    deliberatePauses?: ExpressionDirective['deliberatePauses'];
    responseLength?: ExpressionDirective['responseLength'];
    tone?: ExpressionDirective['tone'];
    reasoningDepth?: ExpressionDirective['reasoningDepth'];
    interactionStyle?: ExpressionDirective['interactionStyle'];
    creativeStyle?: ExpressionDirective['creativeStyle'];
    explanationStyle?: ExpressionDirective['explanationStyle'];
    decisionPresentation?: ExpressionDirective['decisionPresentation'];
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
    ...(directive?.register ? { register: directive.register } : {}),
    ...(directive?.cadenceStyle ? { cadenceStyle: directive.cadenceStyle } : {}),
    ...(directive?.pauseDensity ? { pauseDensity: directive.pauseDensity } : {}),
    ...(directive?.metaphorDensity ? { metaphorDensity: directive.metaphorDensity } : {}),
    ...(directive?.bitDepth !== undefined ? { bitDepth: directive.bitDepth } : {}),
    ...(directive?.allowPlayfulDisagreement !== undefined ? { allowPlayfulDisagreement: directive.allowPlayfulDisagreement } : {}),
    ...(directive?.symbolicFraming ? { symbolicFraming: directive.symbolicFraming } : {}),
    ...(directive?.storytellingDepth ? { storytellingDepth: directive.storytellingDepth } : {}),
    ...(directive?.edginess ? { edginess: directive.edginess } : {}),
    ...(directive?.reentryToPlayfulness ? { reentryToPlayfulness: directive.reentryToPlayfulness } : {}),
    ...(directive?.operationalSass ? { operationalSass: directive.operationalSass } : {}),
    ...(directive?.affectionateTeasing !== undefined ? { affectionateTeasing: directive.affectionateTeasing } : {}),
    ...(directive?.workloadBoundary ? { workloadBoundary: directive.workloadBoundary } : {}),
    ...(directive?.evidenceDiscipline ? { evidenceDiscipline: directive.evidenceDiscipline } : {}),
    ...(directive?.speakingRate ? { speakingRate: directive.speakingRate } : {}),
    ...(directive?.deliberatePauses !== undefined ? { deliberatePauses: directive.deliberatePauses } : {}),
    ...(directive?.responseLength ? { responseLength: directive.responseLength } : {}),
    ...(directive?.tone ? { tone: directive.tone } : {}),
    ...(directive?.reasoningDepth ? { reasoningDepth: directive.reasoningDepth } : {}),
    ...(directive?.interactionStyle ? { interactionStyle: directive.interactionStyle } : {}),
    ...(directive?.creativeStyle ? { creativeStyle: directive.creativeStyle } : {}),
    ...(directive?.explanationStyle ? { explanationStyle: directive.explanationStyle } : {}),
    ...(directive?.decisionPresentation ? { decisionPresentation: directive.decisionPresentation } : {}),
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

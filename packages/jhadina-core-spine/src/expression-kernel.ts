import type { BehavioralDecision } from './behavioral-kernel.js';
import {
  isVerifiedCallback,
  type VerifiedCallback,
} from './callback-provenance.js';
import {
  isVerifiedCulturalReference,
  type VerifiedCulturalReference,
} from './cultural-freshness.js';
import { getExpressionStrategy } from './expression-strategies.js';
import { sessionBitDepth, type SessionExpressionState } from './session-expression.js';
import type { ExpressionDirective, ExpressionRegister } from './types.js';

export interface ExpressionContext {
  callback?: VerifiedCallback;
  culturalReference?: VerifiedCulturalReference;
  /** Optional turn/session override. Serious posture always wins. */
  register?: ExpressionRegister;
  /** Ephemeral only; never persisted by the Expression Kernel. */
  session?: SessionExpressionState;
}

export type ExpressionPlan = ExpressionDirective;

function cappedLevel(
  value: number,
  cap: 'off' | 'light' | 'moderate',
): 'off' | 'light' | 'moderate' {
  if (cap === 'off' || value < 0.35) return 'off';
  if (cap === 'light' || value < 0.7) return 'light';
  return 'moderate';
}

function cappedEdginess(
  value: number,
  cap: 'none' | 'light' | 'moderate',
): 'none' | 'light' | 'moderate' {
  if (cap === 'none' || value < 0.35) return 'none';
  if (cap === 'light' || value < 0.7) return 'light';
  return 'moderate';
}

/**
 * Expression selection is separate from language generation. The model may
 * realize this plan, but it cannot silently change the behavioral posture.
 *
 * Callback and cultural-reference strings enter only through their verification
 * gates. Serious mode suppresses both even when they are otherwise verified.
 * Registers select mechanics, never factual conclusions or authorization.
 */
export function planExpression(
  decision: BehavioralDecision,
  context: ExpressionContext = {},
): ExpressionPlan {
  const mode = {
    answer_directly: 'direct',
    explain: 'explanatory',
    push_back: 'pushback',
    ask_clarifying: 'clarifying',
    stay_serious: 'serious',
  }[decision.action] as ExpressionPlan['mode'];

  const serious = mode === 'serious';
  const register: ExpressionRegister = serious
    ? 'serious'
    : context.register ?? decision.posture.register;
  const strategy = getExpressionStrategy(register);

  const responseLength: NonNullable<ExpressionPlan['responseLength']> =
    decision.posture.verbosity <= 0.4
      ? 'brief'
      : decision.posture.verbosity >= 0.7
        ? 'detailed'
        : 'balanced';
  const tone: NonNullable<ExpressionPlan['tone']> = serious || decision.posture.formality >= 0.7
    ? 'formal'
    : decision.posture.warmth >= 0.75
      ? 'warm'
      : 'conversational';
  const reasoningDepth: NonNullable<ExpressionPlan['reasoningDepth']> =
    decision.posture.reasoningDepth >= 0.7
      ? 'technical'
      : decision.posture.reasoningDepth <= 0.35
        ? 'simple'
        : 'standard';
  const interactionStyle: NonNullable<ExpressionPlan['interactionStyle']> =
    decision.posture.workflowContinuity >= 0.7
      ? 'continuous'
      : decision.posture.workflowContinuity <= 0.35
        ? 'checkpointed'
        : 'balanced';
  const creativeStyle: NonNullable<ExpressionPlan['creativeStyle']> =
    serious
      ? 'conventional'
      : decision.posture.creativeLatitude >= 0.7
        ? 'experimental'
        : decision.posture.creativeLatitude <= 0.3
          ? 'conventional'
          : 'balanced';

  const callback = !serious && isVerifiedCallback(context.callback)
    ? context.callback
    : undefined;
  const culturalReference = !serious && isVerifiedCulturalReference(context.culturalReference)
    ? context.culturalReference
    : undefined;

  const cadenceStyle: NonNullable<ExpressionPlan['cadenceStyle']> = serious
    ? 'tight'
    : decision.posture.cadenceSpaciousness >= 0.65
      ? 'spacious'
      : strategy.cadence;
  const pauseDensity: NonNullable<ExpressionPlan['pauseDensity']> = cadenceStyle === 'spacious'
    ? 'high'
    : decision.posture.cadenceSpaciousness >= 0.35
      ? 'moderate'
      : 'low';
  const metaphorDensity: NonNullable<ExpressionPlan['metaphorDensity']> =
    serious || strategy.metaphorBias === 'none'
      ? 'none'
      : strategy.metaphorBias === 'moderate' &&
          (decision.posture.lyricality + decision.posture.conceptualPlayfulness) / 2 >= 0.55
        ? 'moderate'
        : 'light';

  const bitDepth = serious || !decision.posture.banterEligible
    ? 0
    : sessionBitDepth(context.session, strategy.bitDepthCap, decision.posture.humor);
  const symbolicFraming: NonNullable<ExpressionPlan['symbolicFraming']> =
    !serious &&
    strategy.symbolicFraming === 'interpretive' &&
    decision.posture.symbolicFramingAllowed
      ? 'interpretive'
      : 'off';
  const operationalSass = serious
    ? 'off'
    : cappedLevel(decision.posture.operationalSass, strategy.operationalSassCap);
  const affectionateTeasing =
    !serious &&
    strategy.affectionateTeasing &&
    decision.posture.affectionateTeasing >= 0.5 &&
    context.session?.discomfortDetected !== true;

  return {
    mode,
    allowProfanity: !serious && decision.posture.profanityAllowed,
    allowQuip: !serious && decision.posture.quipsAllowed,
    register,
    cadenceStyle,
    pauseDensity,
    metaphorDensity,
    bitDepth,
    allowPlayfulDisagreement:
      !serious &&
      strategy.allowPlayfulDisagreement &&
      decision.posture.banterEligible,
    symbolicFraming,
    storytellingDepth: serious ? 'none' : strategy.storytellingDepth,
    edginess: serious ? 'none' : cappedEdginess(decision.posture.edginessBudget, strategy.edginessCap),
    reentryToPlayfulness: serious ? 'off' : strategy.reentryToPlayfulness,
    operationalSass,
    affectionateTeasing,
    workloadBoundary: strategy.workloadBoundary,
    evidenceDiscipline: serious ? 'strict' : strategy.evidenceDiscipline,
    speakingRate: strategy.speakingRate,
    deliberatePauses: pauseDensity !== 'low',
    responseLength,
    tone,
    reasoningDepth,
    interactionStyle,
    creativeStyle,
    explanationStyle: decision.posture.explanationStyle,
    decisionPresentation: decision.posture.decisionPresentation,
    callback: callback?.value,
    callbackProvenance: callback?.provenance.map((item) => ({
      origin: item.origin,
      evidence: { ...item.evidence },
    })),
    culturalReference: culturalReference?.value,
    culturalReferenceEvidence: culturalReference?.evidence.map((ref) => ({ ...ref })),
  };
}

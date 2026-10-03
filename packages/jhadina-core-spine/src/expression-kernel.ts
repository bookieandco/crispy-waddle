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
import type { QuipPlan } from './quip-engine.js';
import type { BanterBitRuntime } from './banter-bit-engine.js';
import type { ExpressionDirective, ExpressionProsodyGenome, ExpressionRegister } from './types.js';

export interface ExpressionContext {
  callback?: VerifiedCallback;
  culturalReference?: VerifiedCulturalReference;
  /** Optional turn/session override. Serious posture always wins. */
  register?: ExpressionRegister;
  /** Ephemeral only; never persisted by the Expression Kernel. */
  session?: SessionExpressionState;
  /** Already-governed fast-lane quip selection. */
  quip?: QuipPlan;
  /** Already-governed ephemeral banter state. */
  banter?: BanterBitRuntime;
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

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function prosodyGenome(
  decision: BehavioralDecision,
  directive: {
    serious: boolean;
    cadenceStyle: 'tight' | 'conversational' | 'spacious';
    pauseDensity: 'low' | 'moderate' | 'high';
    storytellingDepth: 'none' | 'brief' | 'extended';
  },
): ExpressionProsodyGenome {
  const posture = decision.posture;
  const cadence = directive.cadenceStyle === 'tight' ? 0.28 : directive.cadenceStyle === 'spacious' ? 0.78 : 0.52;
  const pause = directive.pauseDensity === 'low' ? 0.2 : directive.pauseDensity === 'high' ? 0.82 : 0.52;
  const storytelling = directive.storytellingDepth === 'none' ? 0 : directive.storytellingDepth === 'extended' ? 0.9 : 0.48;
  const playfulness = directive.serious ? 0 : clamp01((posture.humor + posture.conceptualPlayfulness) / 2);

  return Object.freeze({
    cadence,
    microPauseDensity: pause,
    thoughtPauseDurationMs: Math.round(120 + 520 * pause + 260 * clamp01(posture.cadenceSpaciousness)),
    pitchRange: directive.serious ? 0.3 : clamp01(0.35 + 0.35 * playfulness + 0.2 * posture.emotionalIntimacy),
    pitchContour: directive.serious ? 'level' : playfulness >= 0.7 ? 'dynamic' : 'gentle',
    energy: directive.serious ? 0.5 : clamp01(0.42 + 0.3 * posture.humor + 0.18 * posture.operationalSass),
    warmth: directive.serious ? Math.min(posture.warmth, 0.55) : clamp01(posture.warmth),
    groundedConfidence: clamp01(0.55 + 0.35 * posture.directness),
    conversationality: directive.serious ? 0.35 : clamp01(0.45 + 0.3 * posture.relationshipCalibration + 0.2 * posture.culturalFluency),
    intimacy: directive.serious ? 0 : clamp01(posture.intimacyEligible ? posture.emotionalIntimacy : posture.emotionalIntimacy * 0.35),
    breathiness: directive.serious ? 0.12 : clamp01(0.12 + 0.22 * posture.cadenceSpaciousness + 0.18 * posture.emotionalIntimacy),
    emphasis: clamp01(0.4 + 0.35 * posture.directness + 0.15 * posture.protocolPushback),
    sentenceFinality: directive.serious ? 0.9 : clamp01(0.48 + 0.28 * posture.directness - 0.15 * posture.conceptualPlayfulness),
    spontaneity: directive.serious ? 0.12 : clamp01(0.28 + 0.3 * playfulness + 0.18 * posture.conversationTemperature),
    reactionIntensity: directive.serious ? 0.1 : clamp01(0.2 + 0.35 * posture.humor + 0.2 * posture.conversationTemperature),
    playfulness,
    operationalSass: directive.serious ? 0 : clamp01(posture.operationalSass),
    absurdEscalation: directive.serious ? 0 : clamp01(posture.absurdEscalation),
    poeticCompression: directive.serious ? 0 : clamp01(posture.poeticCompression),
    storytellingIntensity: directive.serious ? 0 : clamp01(storytelling),
  });
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
  const storytellingDepth = serious ? 'none' : strategy.storytellingDepth;
  const genome = prosodyGenome(decision, { serious, cadenceStyle, pauseDensity, storytellingDepth });
  const quip = !serious && context.quip ? context.quip : undefined;
  const banter = !serious && context.banter ? context.banter : undefined;

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
    storytellingDepth,
    edginess: serious ? 'none' : cappedEdginess(decision.posture.edginessBudget, strategy.edginessCap),
    reentryToPlayfulness: serious ? 'off' : strategy.reentryToPlayfulness,
    operationalSass,
    affectionateTeasing,
    workloadBoundary: strategy.workloadBoundary,
    evidenceDiscipline: serious ? 'strict' : strategy.evidenceDiscipline,
    speakingRate: strategy.speakingRate,
    deliberatePauses: pauseDensity !== 'low',
    prosodyGenome: genome,
    ...(quip ? { quip: {
      candidateId: quip.candidateId,
      text: quip.text,
      score: quip.score,
      ...(quip.truthReconnect ? { truthReconnect: quip.truthReconnect } : {}),
    } } : {}),
    ...(banter ? { banter: {
      bitId: banter.bitId,
      stage: banter.stage,
      depth: banter.depth,
      shouldReturnToTask: banter.exited,
    } } : {}),
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

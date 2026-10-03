import type { BehavioralDecision } from './behavioral-kernel.js';
import type { VerifiedCallback } from './callback-provenance.js';
import type { SessionExpressionState } from './session-expression.js';

export interface QuipCandidate {
  id: string;
  text: string;
  naturalness: number;
  timing: number;
  contextFit: number;
  relationshipFit: number;
  personalityFit: number;
  truthCompatibility: number;
  repetitionRisk?: number;
  crueltyRisk?: number;
  taskInterruptionCost?: number;
  truthReconnect?: string;
  callback?: VerifiedCallback;
}

export interface QuipPlan {
  candidateId: string;
  text: string;
  score: number;
  truthReconnect?: string;
  callback?: VerifiedCallback;
  structure: readonly [
    'reality',
    'contrast',
    'escalation',
    'optional-self-implication',
    'callback-or-punchline',
    'truth-reconnect',
  ];
}

export interface QuipSelectionContext {
  candidates: readonly QuipCandidate[];
  session?: SessionExpressionState;
  minimumScore?: number;
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function serious(decision: BehavioralDecision): boolean {
  return decision.action === 'stay_serious' ||
    decision.posture.humor <= 0 ||
    !decision.posture.quipsAllowed;
}

export function scoreQuipCandidate(
  candidate: QuipCandidate,
  decision: BehavioralDecision,
  session?: SessionExpressionState,
): number {
  const positive =
    0.16 * clamp(candidate.naturalness) +
    0.15 * clamp(candidate.timing) +
    0.16 * clamp(candidate.contextFit) +
    0.12 * clamp(candidate.relationshipFit) +
    0.14 * clamp(candidate.personalityFit) +
    0.17 * clamp(candidate.truthCompatibility) +
    0.10 * clamp(decision.posture.quipIntensity);

  const fatigueFromSession = session?.bits.some((bit) =>
    candidate.callback?.value &&
    bit.phrase.trim().toLowerCase() === candidate.callback.value.trim().toLowerCase() &&
    bit.uses >= 2
  ) ? 0.2 : 0;

  const penalties =
    0.12 * clamp(candidate.repetitionRisk ?? 0) +
    0.25 * clamp(candidate.crueltyRisk ?? 0) +
    0.18 * clamp(candidate.taskInterruptionCost ?? 0) +
    fatigueFromSession;

  return clamp(positive - penalties);
}

/**
 * Fast-lane quip selection. It may deliberately return undefined.
 * Core Spine chooses whether a quip is eligible and which candidate wins;
 * language realization remains downstream.
 */
export function selectQuip(
  decision: BehavioralDecision,
  context: QuipSelectionContext,
): QuipPlan | undefined {
  if (serious(decision) || context.session?.discomfortDetected === true) return undefined;

  const minimumScore = clamp(context.minimumScore ?? 0.58);
  const ranked = context.candidates
    .slice(0, 3)
    .map((candidate) => ({ candidate, score: scoreQuipCandidate(candidate, decision, context.session) }))
    .filter(({ candidate }) =>
      candidate.text.trim().length > 0 &&
      clamp(candidate.truthCompatibility) >= 0.5 &&
      clamp(candidate.crueltyRisk ?? 0) < 0.5
    )
    .sort((a, b) => b.score - a.score || a.candidate.id.localeCompare(b.candidate.id));

  const winner = ranked[0];
  if (!winner || winner.score < minimumScore) return undefined;

  return Object.freeze({
    candidateId: winner.candidate.id,
    text: winner.candidate.text.trim(),
    score: winner.score,
    ...(winner.candidate.truthReconnect?.trim()
      ? { truthReconnect: winner.candidate.truthReconnect.trim() }
      : {}),
    ...(winner.candidate.callback ? { callback: winner.candidate.callback } : {}),
    structure: Object.freeze([
      'reality',
      'contrast',
      'escalation',
      'optional-self-implication',
      'callback-or-punchline',
      'truth-reconnect',
    ] as const),
  });
}

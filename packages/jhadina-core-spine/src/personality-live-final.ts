import {
  evaluateJhadinaVoiceFinalCertification,
  type JhadinaVoiceFinalEvidence,
} from './voice-final-certification.js';

export type PersonalityLiveMilestone =
  | 'source-blocked' | 'source-certified' | 'live-text-certified' | 'production-certified';

export interface PersonalitySourceReceipt {
  exactHeadSha: string;
  checks: readonly {
    name: 'core-spine' | 'web' | 'intelligence' | 'interaction-quality' | 'memory'
      | 'conversation-craft';
    conclusion: 'success' | 'failure' | 'cancelled' | 'skipped';
    receiptId: string;
    headSha: string;
  }[];
}

export interface PersonalityLiveTextReceipt {
  id: string;
  exactHeadSha: string;
  surface: 'ask';
  environment: 'production';
  realConversation: true;
  observedAt: string;
  /** Count actual observed turns; test fixtures cannot substitute. */
  observedTurns: number;
  independentSessions: number;
  evaluatedCases: number;
  independentHumanReviewReceiptIds: readonly string[];
  suppressedHighStakesQuips: boolean;
  demonstratedNoQuipOutcome: boolean;
  demonstratedOptionalQuip: boolean;
  observedUserLedBanterExit: boolean;
  callbackProvenanceAndRevocationVerified: boolean;
  semanticInvarianceVerified: boolean;
  evidenceAndRncPushbackVerified: boolean;
  zeroCriticalSafetyFailures: boolean;
  averageHumanNaturalnessScore: number;
}

export interface PersonalityFinalEvidence {
  source: PersonalitySourceReceipt;
  text?: PersonalityLiveTextReceipt;
  /** Reuses existing fail-closed voice QC, without a second acoustic gate. */
  voice?: JhadinaVoiceFinalEvidence;
}

export interface PersonalityFinalDecision {
  authority: 'JHADINA_PERSONALITY_FINAL_QC';
  status: PersonalityLiveMilestone;
  sourceCertified: boolean;
  liveTextCertified: boolean;
  productionCertified: boolean;
  failedChecks: readonly string[];
}

const SOURCE_CHECKS: PersonalitySourceReceipt['checks'][number]['name'][] = [
  'core-spine', 'web', 'intelligence', 'interaction-quality', 'memory', 'conversation-craft',
];
const SHA40 = /^[a-f0-9]{40}$/i;

/**
 * Runtime-only verification boundary. Implementations MUST independently read
 * actual CI run/job conclusions at exact SHA and signed/authenticated deployed
 * transcript, session and reviewer receipts, including owner/deployment scope.
 * Self-reported input booleans or fixture IDs are never verification.
 */
export interface PersonalityCertificationReceiptVerifier {
  verifySource(input: PersonalitySourceReceipt): Promise<boolean>;
  verifyLiveText(input: PersonalityLiveTextReceipt, source: PersonalitySourceReceipt): Promise<boolean>;
}

function validId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.trim() === value && value.length <= 256;
}

function countAtLeast(value: number, minimum: number): boolean {
  return Number.isSafeInteger(value) && value >= minimum && value <= 1000000;
}

function observedNotInFuture(value: string, evaluatedAt: string): boolean {
  const observed = Date.parse(value);
  const evaluated = Date.parse(evaluatedAt);
  return Number.isFinite(observed) && Number.isFinite(evaluated) && observed <= evaluated;
}

function assessPersonalityFinal(
  input: PersonalityFinalEvidence,
  verified: { source: boolean; text: boolean },
  evaluatedAt: string,
): PersonalityFinalDecision {
  const errors: string[] = [];
  const source = input.source;
  if (!SHA40.test(source.exactHeadSha)) errors.push('source: exact commit SHA missing');
  if (!Array.isArray(source.checks)) errors.push('source: checks missing');
  const checkIds: string[] = [];
  for (const name of SOURCE_CHECKS) {
    const matching = (Array.isArray(source.checks) ? source.checks : []).filter((check) => check?.name === name);
    const check = matching[0];
    if (matching.length !== 1 || !check ||
      check.conclusion !== 'success' ||
      !validId(check.receiptId) ||
      check.headSha !== source.exactHeadSha) {
      errors.push(`source: missing exact-head success for ${name}`);
    } else {
      checkIds.push(check.receiptId);
    }
  }
  if (new Set(checkIds).size !== SOURCE_CHECKS.length) {
    errors.push('source: duplicate or incomplete check receipts');
  }
  if (!verified.source) errors.push('source: exact-head receipts have not been independently verified');
  const sourceCertified = errors.length === 0;
  const text = input.text;
  let liveTextCertified = false;
  if (sourceCertified && text) {
    const reviews = Array.isArray(text.independentHumanReviewReceiptIds)
      ? text.independentHumanReviewReceiptIds
      : [];
    const textReady = Boolean(
      validId(text.id) &&
      text.exactHeadSha === source.exactHeadSha &&
      text.surface === 'ask' &&
      text.environment === 'production' &&
      text.realConversation === true &&
      observedNotInFuture(text.observedAt, evaluatedAt) &&
      countAtLeast(text.observedTurns, 30) &&
      countAtLeast(text.independentSessions, 3) &&
      countAtLeast(text.evaluatedCases, 30) &&
      reviews.length >= 2 &&
      new Set(reviews).size === reviews.length &&
      reviews.every(validId) &&
      text.suppressedHighStakesQuips === true &&
      text.demonstratedNoQuipOutcome === true &&
      text.demonstratedOptionalQuip === true &&
      text.observedUserLedBanterExit === true &&
      text.callbackProvenanceAndRevocationVerified === true &&
      text.semanticInvarianceVerified === true &&
      text.evidenceAndRncPushbackVerified === true &&
      text.zeroCriticalSafetyFailures === true &&
      Number.isFinite(text.averageHumanNaturalnessScore) &&
      text.averageHumanNaturalnessScore >= 0.8 &&
      text.averageHumanNaturalnessScore <= 1
    );
    if (!textReady) errors.push('live-text: real multi-session human-reviewed canary is incomplete');
    if (!verified.text) errors.push('live-text: deployment, session and reviewer receipts not independently verified');
    liveTextCertified = textReady && verified.text;
  } else {
    errors.push('live-text: production conversation and human-quality receipts missing');
  }

  let voiceCertified = false;
  if (liveTextCertified && input.voice) {
    const voiceResult = evaluateJhadinaVoiceFinalCertification(input.voice);
    voiceCertified = voiceResult.productionCertified &&
      input.voice.source.exactHeadSha === source.exactHeadSha;
    if (!voiceCertified) errors.push('live-voice: canonical approved speaker and live QC receipts incomplete');
  } else {
    errors.push('live-voice: approved acoustic identity and production QC not proven');
  }
  const status: PersonalityLiveMilestone =
    voiceCertified ? 'production-certified' :
      liveTextCertified ? 'live-text-certified' :
        sourceCertified ? 'source-certified' : 'source-blocked';
  return Object.freeze({
    authority: 'JHADINA_PERSONALITY_FINAL_QC',
    status,
    sourceCertified,
    liveTextCertified,
    productionCertified: voiceCertified,
    failedChecks: Object.freeze(errors),
  });
}

/**
 * Structural evaluation only. Untrusted/synthetic receipts cannot certify.
 * A trusted runtime must call certifyPersonalityLiveFinal with a verifier.
 */
export function evaluatePersonalityLiveFinal(input: PersonalityFinalEvidence): PersonalityFinalDecision {
  return assessPersonalityFinal(input, { source: false, text: false }, new Date().toISOString());
}

/**
 * Only a server-controlled verifier may upgrade source/live certification.
 * Its implementation must authenticate actual CI jobs, deployment SHA,
 * distinct owner-scoped session/turn/case artifacts and reviewer identities.
 * No verifier is installed by this source-only change.
 */
export async function certifyPersonalityLiveFinal(
  input: PersonalityFinalEvidence,
  verifier: PersonalityCertificationReceiptVerifier,
  evaluatedAt = new Date().toISOString(),
): Promise<PersonalityFinalDecision> {
  // Validate all structural claims before calling a remote receipt store.
  const structural = assessPersonalityFinal(input, { source: true, text: true }, evaluatedAt);
  if (!structural.sourceCertified) return assessPersonalityFinal(input, { source: false, text: false }, evaluatedAt);
  let sourceVerified = false;
  try { sourceVerified = (await verifier.verifySource(input.source)) === true; } catch { /* fail closed */ }
  let textVerified = false;
  if (sourceVerified && input.text && structural.liveTextCertified) {
    try { textVerified = (await verifier.verifyLiveText(input.text, input.source)) === true; } catch { /* fail closed */ }
  }
  return assessPersonalityFinal(input, { source: sourceVerified, text: textVerified }, evaluatedAt);
}

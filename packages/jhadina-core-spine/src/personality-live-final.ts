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

export function evaluatePersonalityLiveFinal(input: PersonalityFinalEvidence): PersonalityFinalDecision {
  const errors: string[] = [];
  const source = input.source;
  if (!SHA40.test(source.exactHeadSha)) errors.push('source: exact commit SHA missing');
  for (const name of SOURCE_CHECKS) {
    const matching = source.checks.filter((check) => check.name === name);
    if (matching.length !== 1 ||
      matching[0]?.conclusion !== 'success' ||
      !matching[0].receiptId.trim() ||
      matching[0].headSha !== source.exactHeadSha) {
      errors.push(`source: missing exact-head success for ${name}`);
    }
  }
  const sourceCertified = errors.length === 0;
  const text = input.text;
  let liveTextCertified = false;
  if (sourceCertified && text) {
    const textReady = Boolean(
      text.id.trim() &&
      text.exactHeadSha === source.exactHeadSha &&
      text.surface === 'ask' &&
      text.environment === 'production' &&
      text.realConversation === true &&
      Number.isFinite(Date.parse(text.observedAt)) &&
      text.observedTurns >= 30 &&
      text.independentSessions >= 3 &&
      text.evaluatedCases >= 30 &&
      text.independentHumanReviewReceiptIds.length >= 2 &&
      new Set(text.independentHumanReviewReceiptIds).size === text.independentHumanReviewReceiptIds.length &&
      text.independentHumanReviewReceiptIds.every(Boolean) &&
      text.suppressedHighStakesQuips &&
      text.demonstratedNoQuipOutcome &&
      text.demonstratedOptionalQuip &&
      text.observedUserLedBanterExit &&
      text.callbackProvenanceAndRevocationVerified &&
      text.semanticInvarianceVerified &&
      text.evidenceAndRncPushbackVerified &&
      text.zeroCriticalSafetyFailures &&
      Number.isFinite(text.averageHumanNaturalnessScore) &&
      text.averageHumanNaturalnessScore >= 0.8 &&
      text.averageHumanNaturalnessScore <= 1,
    );
    if (!textReady) errors.push('live-text: real multi-session human-reviewed canary is incomplete');
    liveTextCertified = textReady;
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

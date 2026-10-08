import { describe, expect, it } from 'vitest';
import { evaluatePersonalityLiveFinal, type PersonalitySourceReceipt, type PersonalityLiveTextReceipt } from './personality-live-final.js';

const head = 'a'.repeat(40);
const names = [
  'core-spine', 'web', 'intelligence', 'interaction-quality', 'memory', 'conversation-craft',
] as const;
const source = (): PersonalitySourceReceipt => ({
  exactHeadSha: head,
  checks: names.map((name) => ({
    name, conclusion: 'success', receiptId: 'github-run:' + name, headSha: head,
  })),
});
const textReceipt = (): PersonalityLiveTextReceipt => ({
  id: 'live-text-human-observation',
  exactHeadSha: head,
  surface: 'ask',
  environment: 'production',
  realConversation: true,
  observedAt: '2026-10-08T20:00:00Z',
  observedTurns: 42,
  independentSessions: 4,
  evaluatedCases: 34,
  independentHumanReviewReceiptIds: ['reviewer:one', 'reviewer:two'],
  suppressedHighStakesQuips: true,
  demonstratedNoQuipOutcome: true,
  demonstratedOptionalQuip: true,
  observedUserLedBanterExit: true,
  callbackProvenanceAndRevocationVerified: true,
  semanticInvarianceVerified: true,
  evidenceAndRncPushbackVerified: true,
  zeroCriticalSafetyFailures: true,
  averageHumanNaturalnessScore: 0.9,
});

describe('JHADINA-PERSONALITY.FINAL must distinguish code from reality', () => {
  it('rejects absent or mixed exact-head checks', () => {
    expect(evaluatePersonalityLiveFinal({ source: { ...source(), checks: [] } }).status).toBe('source-blocked');
    const bad = source();
    bad.checks[0]!.headSha = 'b'.repeat(40);
    expect(evaluatePersonalityLiveFinal({ source: bad }).status).toBe('source-blocked');
  });
  it('never promotes source only to production', () => {
    expect(evaluatePersonalityLiveFinal({ source: source() }).status).toBe('source-certified');
  });
  it('rejects synthetic, low-volume and unreviewed text evidence', () => {
    const bad = textReceipt();
    bad.observedTurns = 4;
    bad.independentHumanReviewReceiptIds = [];
    expect(evaluatePersonalityLiveFinal({ source: source(), text: bad }).status).toBe('source-certified');
  });
  it('certifies live text only after actual qualifying receipts but not the unapproved voice', () => {
    const result = evaluatePersonalityLiveFinal({ source: source(), text: textReceipt() });
    expect(result.status).toBe('live-text-certified');
    expect(result.productionCertified).toBe(false);
    expect(result.failedChecks).toContain('live-voice: approved acoustic identity and production QC not proven');
  });
});

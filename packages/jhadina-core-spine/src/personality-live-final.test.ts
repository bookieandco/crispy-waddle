import { describe, expect, it } from 'vitest';
import { evaluatePersonalityLiveFinal, certifyPersonalityLiveFinal, type PersonalitySourceReceipt, type PersonalityLiveTextReceipt } from './personality-live-final.js';

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
  it('does not treat self-reported source receipts as verified', () => {
    expect(evaluatePersonalityLiveFinal({ source: source() }).status).toBe('source-blocked');
  });
  it('rejects synthetic, low-volume and unreviewed text evidence', () => {
    const bad = textReceipt();
    bad.observedTurns = 4;
    bad.independentHumanReviewReceiptIds = [];
    expect(evaluatePersonalityLiveFinal({ source: source(), text: bad }).status).toBe('source-blocked');
  });
  it('fails closed on malformed, forged, future, duplicate and untrusted receipts', async () => {
    const trusted = { verifySource: async () => true, verifyLiveText: async () => true };
    const textCases: Array<(receipt: PersonalityLiveTextReceipt) => void> = [
      (r) => { r.observedTurns = Infinity },
      (r) => { r.independentSessions = 3.5 },
      (r) => { r.evaluatedCases = Infinity },
      (r) => { r.independentHumanReviewReceiptIds = ['  ', 'reviewer:two'] },
      (r) => { r.independentHumanReviewReceiptIds = ['reviewer:one', 'reviewer:one'] },
      (r) => { r.observedAt = '2099-01-01T00:00:00Z' },
      (r) => { r.exactHeadSha = 'f'.repeat(40) },
    ];
    for (const mutate of textCases) {
      const input = textReceipt();
      mutate(input);
      const result = await certifyPersonalityLiveFinal({ source: source(), text: input }, trusted, '2026-10-17T12:00:00Z');
      expect(result.liveTextCertified).toBe(false);
      expect(result.productionCertified).toBe(false);
    }
    const duplicate = source();
    duplicate.checks[1]!.receiptId = duplicate.checks[0]!.receiptId;
    expect((await certifyPersonalityLiveFinal({ source: duplicate, text: textReceipt() }, trusted)).sourceCertified).toBe(false);
    expect((await certifyPersonalityLiveFinal({ source: source(), text: textReceipt() }, {
      verifySource: async () => false, verifyLiveText: async () => true,
    })).status).toBe('source-blocked');
    expect((await certifyPersonalityLiveFinal({ source: source(), text: textReceipt() }, {
      verifySource: async () => true, verifyLiveText: async () => false,
    })).status).toBe('source-certified');
  });

  it('allows a trusted verifier adapter to classify synthetic qualifying fixtures without commissioning voice', async () => {
    // These are unit-test fakes ONLY, not production transcripts, reviews or evidence.
    const result = await certifyPersonalityLiveFinal({ source: source(), text: textReceipt() }, {
      verifySource: async () => true,
      verifyLiveText: async () => true,
    }, '2026-10-17T12:00:00Z');
    expect(result.status).toBe('live-text-certified');
    expect(result.productionCertified).toBe(false);
    expect(result.failedChecks).toContain('live-voice: approved acoustic identity and production QC not proven');
  });
});

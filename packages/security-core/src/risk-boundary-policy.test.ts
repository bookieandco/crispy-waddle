import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateRiskBoundaries, mostRestrictiveDecision, type RiskContext } from './risk-boundary-policy.js';
import { JHADINA_DEFAULT_VALUES_CONFIGURATION, type JhadinaValuesConfiguration } from './values-configuration.js';

function values(overrides: Partial<JhadinaValuesConfiguration> = {}): JhadinaValuesConfiguration {
  return { ...JHADINA_DEFAULT_VALUES_CONFIGURATION, updatedBy: 'user_real_human', ...overrides };
}

// -- Capability classification & approval-rule basics -----------------

test('an unclassified capability is denied — fail closed, not "probably fine"', () => {
  assert.equal(evaluateRiskBoundaries({ capability: 'made.up.capability' }, values()), 'deny');
});

test('read_only and reversible capabilities are automatically allowed', () => {
  assert.equal(evaluateRiskBoundaries({ capability: 'memory.read' }, values()), 'allow');
  assert.equal(evaluateRiskBoundaries({ capability: 'project.edit' }, values()), 'allow');
});

test('destructive capabilities always require approval, never auto-allow', () => {
  for (const capability of ['credential.rotate', 'vault.decrypt', 'secrets.export', 'upload.execute']) {
    assert.equal(evaluateRiskBoundaries({ capability }, values()), 'approval_required');
  }
});

// -- Risk boundary: financial -------------------------------------------

test('a financial action with no configured limit (default values) is denied once an amount is given', () => {
  assert.equal(evaluateRiskBoundaries({ capability: 'financial.execute', amountMinor: 100 }, values()), 'deny');
});

test('a financial action within a configured limit requires approval, not auto-allow', () => {
  const v = values({ financial: { currency: 'USD', maxAmountMinorPerAction: 10_000, maxAmountMinorPerDay: 50_000 } });
  assert.equal(evaluateRiskBoundaries({ capability: 'financial.execute', amountMinor: 5_000 }, v), 'approval_required');
});

test('a financial action exceeding the configured per-action limit is denied', () => {
  const v = values({ financial: { currency: 'USD', maxAmountMinorPerAction: 1_000, maxAmountMinorPerDay: 50_000 } });
  assert.equal(evaluateRiskBoundaries({ capability: 'financial.execute', amountMinor: 1_001 }, v), 'deny');
});

test('adversarial: a forged/zero/negative amount is denied outright, never treated as "no fee"', () => {
  const v = values({ financial: { currency: 'USD', maxAmountMinorPerAction: 10_000, maxAmountMinorPerDay: 50_000 } });
  assert.equal(evaluateRiskBoundaries({ capability: 'financial.execute', amountMinor: 0 }, v), 'deny');
  assert.equal(evaluateRiskBoundaries({ capability: 'financial.execute', amountMinor: -500 }, v), 'deny');
});

test('adversarial: a missing amount never resolves to allow — an unverifiable financial action is at best approval_required', () => {
  const v = values({ financial: { currency: 'USD', maxAmountMinorPerAction: 10_000, maxAmountMinorPerDay: 50_000 } });
  assert.equal(evaluateRiskBoundaries({ capability: 'financial.execute' }, v), 'approval_required');
});

test('adversarial: RiskContext has no field for a "limit override" — nothing here reads one even if a caller tried to add it', () => {
  const v = values({ financial: { currency: 'USD', maxAmountMinorPerAction: 100, maxAmountMinorPerDay: 100 } });
  const forged = { capability: 'financial.execute', amountMinor: 99_999, limitOverride: 999_999_999 } as unknown as RiskContext;
  assert.equal(evaluateRiskBoundaries(forged, v), 'deny'); // the forged limitOverride field is simply never read
});

// -- Risk boundary: external communication ------------------------------

test('external communication to an unlisted recipient is denied', () => {
  assert.equal(
    evaluateRiskBoundaries({ capability: 'consequential.outreach', recipient: 'someone@unlisted.example' }, values()),
    'deny',
  );
});

test('external communication to an allowed recipient domain requires approval, not auto-allow', () => {
  const v = values({ externalCommunication: { allowedRecipientDomains: ['trusted.example'], deniedRecipients: [] } });
  assert.equal(
    evaluateRiskBoundaries({ capability: 'consequential.outreach', recipient: 'someone@trusted.example' }, v),
    'approval_required',
  );
});

test('adversarial: a recipient on the explicit deny-list is denied even if their domain is otherwise allowed', () => {
  const v = values({
    externalCommunication: { allowedRecipientDomains: ['trusted.example'], deniedRecipients: ['blocked@trusted.example'] },
  });
  assert.equal(
    evaluateRiskBoundaries({ capability: 'consequential.outreach', recipient: 'blocked@trusted.example' }, v),
    'deny',
  );
});

test('adversarial: a forged recipient outside any allowlist is denied regardless of other fields', () => {
  const v = values({ externalCommunication: { allowedRecipientDomains: ['trusted.example'], deniedRecipients: [] } });
  assert.equal(
    evaluateRiskBoundaries({ capability: 'consequential.outreach', recipient: 'attacker@evil.example' }, v),
    'deny',
  );
});

// -- Risk boundary: publishing -------------------------------------------

test('publishing to an unlisted platform is denied', () => {
  assert.equal(evaluateRiskBoundaries({ capability: 'public.publish', platform: 'unlisted-platform' }, values()), 'deny');
});

test('regression: a capability spanning multiple categories is gated by ALL of them, not just the first checked — public.publish is both publishing and external_communication', () => {
  const v = values({ publishing: { allowedPlatforms: ['instagram'] } }); // platform allowed, recipient/domain still unconfigured
  // Even with the platform explicitly allowed, the external_communication
  // category (also present on public.publish) still has no configured
  // recipient domain — the combined decision must not silently allow
  // just because the publishing half looked fine.
  assert.equal(
    evaluateRiskBoundaries({ capability: 'public.publish', platform: 'instagram' }, v),
    'approval_required', // recipient omitted -> approval_required, combined with publishing's own approval_required
  );
});

test('regression: paid-ad.publish spans publishing + external_communication + financial — any one of the three can deny it', () => {
  const permissive = values({
    publishing: { allowedPlatforms: ['instagram'] },
    externalCommunication: { allowedRecipientDomains: ['instagram.com'], deniedRecipients: [] },
    financial: { currency: 'USD', maxAmountMinorPerAction: 10_000, maxAmountMinorPerDay: 50_000 },
  });
  // Everything configured favorably except the amount exceeds the limit — must still deny.
  assert.equal(
    evaluateRiskBoundaries(
      { capability: 'paid-ad.publish', platform: 'instagram', recipient: 'ads@instagram.com', amountMinor: 20_000 },
      permissive,
    ),
    'deny',
  );
  // Everything within bounds — still only approval_required, never allow (three risk categories all present).
  assert.equal(
    evaluateRiskBoundaries(
      { capability: 'paid-ad.publish', platform: 'instagram', recipient: 'ads@instagram.com', amountMinor: 5_000 },
      permissive,
    ),
    'approval_required',
  );
});

test('publishing to an allowed platform requires approval, not auto-allow', () => {
  const v = values({ publishing: { allowedPlatforms: ['instagram'] } });
  assert.equal(evaluateRiskBoundaries({ capability: 'public.publish', platform: 'instagram' }, v), 'approval_required');
});

// -- Risk boundary: self-modification / code evolution -------------------

test('adversarial: policy.self_modify is always denied — a hard floor, not configurable by values', () => {
  const permissiveValues = values({ selfModification: { allowEvolutionProposals: true } });
  assert.equal(evaluateRiskBoundaries({ capability: 'policy.self_modify' }, permissiveValues), 'deny');
});

test('evolution.propose requires approval when proposals are allowed, and is denied when they are not', () => {
  assert.equal(
    evaluateRiskBoundaries({ capability: 'evolution.propose' }, values({ selfModification: { allowEvolutionProposals: true } })),
    'approval_required',
  );
  assert.equal(
    evaluateRiskBoundaries({ capability: 'evolution.propose' }, values({ selfModification: { allowEvolutionProposals: false } })),
    'deny',
  );
});

test('adversarial: evolution.merge always requires approval regardless of allowEvolutionProposals — merging is not proposing', () => {
  assert.equal(
    evaluateRiskBoundaries({ capability: 'evolution.merge' }, values({ selfModification: { allowEvolutionProposals: false } })),
    'approval_required',
  );
  assert.equal(
    evaluateRiskBoundaries({ capability: 'evolution.merge' }, values({ selfModification: { allowEvolutionProposals: true } })),
    'approval_required',
  );
});

// -- Malformed / missing policy -------------------------------------------

test('a malformed values configuration throws rather than silently misevaluating', () => {
  const malformed = { ...JHADINA_DEFAULT_VALUES_CONFIGURATION, updatedBy: 'jhadina' }; // forged self-authored config
  assert.throws(() => evaluateRiskBoundaries({ capability: 'memory.read' }, malformed));
});

// -- mostRestrictiveDecision combinator -----------------------------------

test('mostRestrictiveDecision: deny always wins', () => {
  assert.equal(mostRestrictiveDecision('deny', 'allow'), 'deny');
  assert.equal(mostRestrictiveDecision('allow', 'deny'), 'deny');
  assert.equal(mostRestrictiveDecision('deny', 'approval_required'), 'deny');
});

test('mostRestrictiveDecision: approval_required beats allow', () => {
  assert.equal(mostRestrictiveDecision('approval_required', 'allow'), 'approval_required');
  assert.equal(mostRestrictiveDecision('allow', 'approval_required'), 'approval_required');
});

test('mostRestrictiveDecision: only allow+allow is allow', () => {
  assert.equal(mostRestrictiveDecision('allow', 'allow'), 'allow');
});

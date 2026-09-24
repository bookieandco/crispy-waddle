import { describe, expect, it } from 'vitest';
import type { GrowthId } from '../domain/types.js';
import { buildAccountLearningProfile } from './social-account-learning.js';
import { InMemorySocialPatternPromotionStore, type SocialPatternPromotionRecord } from './social-pattern-promotion-store.js';

describe('revoked social pattern promotions', () => {
  const promotion = (status: 'promoted' | 'revoked'): SocialPatternPromotionRecord => ({
    id: 'promotion:1' as GrowthId,
    hypothesisId: 'hypothesis:1' as GrowthId,
    sourcePatternId: 'pattern:source' as GrowthId,
    sourceAccountId: 'account:source' as GrowthId,
    targetAccountId: 'account:target' as GrowthId,
    targetAudienceId: 'audience:target' as GrowthId,
    targetVoiceId: 'voice:target' as GrowthId,
    strategy: 'high-intent-hook',
    confidence: 0.95,
    status,
    source: 'validated_experiment',
    experimentId: 'experiment:1' as GrowthId,
    promotedAt: '2026-09-01T10:00:00.000Z',
    ...(status === 'revoked'
      ? { revokedAt: '2026-09-01T11:00:00.000Z', revocationReason: 'regression' }
      : {}),
  });

  it('uses a promoted pattern but excludes the same pattern after revocation', () => {
    const promoted = buildAccountLearningProfile('account:target' as GrowthId, [], [promotion('promoted')]);
    const revoked = buildAccountLearningProfile('account:target' as GrowthId, [], [promotion('revoked')]);

    expect(promoted.strategyScores['high-intent-hook']).toBe(0.95);
    expect(revoked.strategyScores['high-intent-hook']).toBeUndefined();
  });

  it('does not allow a revoked record to be resurrected by a stale promoted write', async () => {
    const store = new InMemorySocialPatternPromotionStore();
    const active = promotion('promoted');
    await store.upsert(active);
    await store.revoke(active.id, '2026-09-01T11:00:00.000Z', 'regression');
    await store.upsert(active);

    const persisted = await store.getById(active.id);
    expect(persisted?.status).toBe('revoked');

    const profile = buildAccountLearningProfile('account:target' as GrowthId, [], persisted ? [persisted] : []);
    expect(profile.strategyScores['high-intent-hook']).toBeUndefined();
  });

  it('never applies a promotion belonging to another target account', () => {
    const profile = buildAccountLearningProfile('account:target' as GrowthId, [], [
      { ...promotion('promoted'), targetAccountId: 'account:other' as GrowthId },
    ]);
    expect(profile.strategyScores['high-intent-hook']).toBeUndefined();
  });
});

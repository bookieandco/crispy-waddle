import { describe, expect, it } from 'vitest';
import { InMemorySocialPatternPromotionStore, persistPromotion } from './social-pattern-promotion-store.js';

describe('promotion store', () => {
  it('persists and scopes promoted patterns by receiving account', async () => {
    const store = new InMemorySocialPatternPromotionStore();
    const promotion = { id: 'promoted:1' as never, hypothesisId: 'hypothesis:1' as never, targetAccountId: 'account:b' as never, targetAudienceId: 'audience:b' as never, targetVoiceId: 'voice:b' as never, strategy: 'playful_challenge', confidence: 0.8, status: 'promoted' as const, source: 'validated_experiment' as const };
    await persistPromotion(store, promotion, 'experiment:1' as never, '2026-08-31T00:00:00Z');
    expect(await store.listForAccount('account:b' as never)).toHaveLength(1);
    expect(await store.listForAccount('account:c' as never)).toHaveLength(0);
  });
});

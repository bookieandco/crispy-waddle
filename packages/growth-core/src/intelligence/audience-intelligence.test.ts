import { describe, expect, it } from 'vitest';
import { buildAudiencePersona, rankProspects, scoreLookalikeCandidate, scorePurchaseIntent } from './audience-intelligence.js';

describe('Growth audience intelligence', () => {
  it('ranks candidates by similarity without sensitive targeting features', () => {
    const persona = buildAudiencePersona([
      { entityId: 'c1', features: { purchase_frequency: 4, pet_product_views: 12, contribution_margin: 180 } },
      { entityId: 'c2', features: { purchase_frequency: 5, pet_product_views: 10, contribution_margin: 220 } },
    ], [
      { entityId: 'p1', features: { purchase_frequency: 1, pet_product_views: 2, contribution_margin: 30 } },
      { entityId: 'p2', features: { purchase_frequency: 2, pet_product_views: 3, contribution_margin: 60 } },
    ]);
    const strong = scoreLookalikeCandidate(persona, { entityId: 'x', features: { purchase_frequency: 4.5, pet_product_views: 11, contribution_margin: 200 } });
    const weak = scoreLookalikeCandidate(persona, { entityId: 'y', features: { purchase_frequency: 0, pet_product_views: 0, contribution_margin: 0 } });
    expect(strong.score).toBeGreaterThan(weak.score);
    expect(rankProspects([
      { entityId: strong.entityId, lookalikeScore: strong.score, intentScore: 0.8 },
      { entityId: weak.entityId, lookalikeScore: weak.score, intentScore: 0.1 },
    ])[0].entityId).toBe('x');
  });

  it('fails closed on sensitive targeting features', () => {
    expect(() => buildAudiencePersona([
      { entityId: 'c1', features: { race: 1, purchase_frequency: 4 } },
    ])).toThrow('GROWTH_SENSITIVE_TARGETING_FEATURE_FORBIDDEN');
  });

  it('scores recent checkout/cart behavior above passive browsing', () => {
    const now = new Date('2026-09-21T20:00:00Z');
    const hot = scorePurchaseIntent('hot', [
      { id: 'e1', customerId: 'hot', type: 'add_to_cart', occurredAt: '2026-09-21T19:00:00Z', source: 'web', confidence: 1 },
      { id: 'e2', customerId: 'hot', type: 'checkout_started', occurredAt: '2026-09-21T19:30:00Z', source: 'web', confidence: 1 },
    ], now);
    const cold = scorePurchaseIntent('cold', [
      { id: 'e3', customerId: 'cold', type: 'page_view', occurredAt: '2026-09-14T19:00:00Z', source: 'web', confidence: 1 },
    ], now);
    expect(hot.score).toBeGreaterThan(cold.score);
    expect(hot.band === 'warm' || hot.band === 'hot').toBe(true);
  });
});

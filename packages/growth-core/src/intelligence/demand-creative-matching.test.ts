import { describe, expect, it } from 'vitest';
import { buildDemandCreativeBrief } from './demand-creative-matching.js';

describe('demand creative matching', () => {
  it('turns high intent plus a matched offer into a purchase-intent brief', () => {
    const brief = buildDemandCreativeBrief({
      buyerSignalId: 'buyer:1' as never,
      platform: 'tiktok',
      topic: 'pet portraits',
      intentLevel: 'high',
      offer: { buyerSignalId: 'buyer:1' as never, offerId: 'offer:1' as never, score: 0.9, reasons: ['topic match'], intentLevel: 'high', availability: 'available' },
      pattern: { id: 'pattern:1' as never, hook: 'numbered', format: 'short-video', structure: 'problem-proof-cta', confidence: 0.9 },
    });

    expect(brief.objective).toBe('drive_purchase_intent');
    expect(brief.hookDirection).toContain('proven');
    expect(brief.originalityRequirements).toContain('Do not reproduce source creative');
    expect(brief.evidence).toEqual(expect.arrayContaining(['buyer:1', 'offer:1', 'pattern:1']));
  });
});

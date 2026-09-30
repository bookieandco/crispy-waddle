import { describe, expect, it } from 'vitest';
import { buildPresenceCampaign, summarizePresenceLearning } from './marketing-presence.js';

describe('marketing presence campaign intelligence', () => {
  it('binds multiple sellable offers to one evidence-backed campaign and durable discovery questions', () => {
    const campaign = buildPresenceCampaign({
      id: 'campaign:music-merch-1',
      brandId: 'brand:atwood-bookie',
      concept: {
        id: 'concept:movie-that-does-not-exist',
        name: 'Movie that does not exist',
        mechanic: 'story',
        thesis: 'Use a fictional-film world to make the song and merch mutually reinforcing.',
        hook: 'The song that sounds like the end credits to a movie that does not exist.',
        evidenceRefs: ['evidence:human-concept'],
        targetQuestions: ['What song sounds like the end credits to a movie that does not exist?'],
      },
      offers: [
        { id: 'offer:song', brandId: 'brand:atwood-bookie', name: 'Featured song', kind: 'music', objective: 'stream', evidenceRefs: ['evidence:song-master'] },
        { id: 'offer:shirt', brandId: 'brand:atwood-bookie', name: 'Film-world shirt', kind: 'merchandise', objective: 'sale', evidenceRefs: ['evidence:shirt-sku'] },
      ],
      bridges: [{ fromOfferId: 'offer:song', toOfferId: 'offer:shirt', relationship: 'story_world', rationale: 'The same fictional-film world supplies both the soundtrack and wearable product.' }],
      createdAt: '2026-09-29T23:50:00-07:00',
    });

    expect(campaign.offerIds).toEqual(['offer:song', 'offer:shirt']);
    expect(campaign.durablePresence).toHaveLength(1);
    expect(campaign.durablePresence[0]?.surfaces).toContain('search:ai');
    expect(campaign.authority).toBe('MARKETING_STRATEGY_ONLY');
  });

  it('rejects cross-offer bridges to products outside the campaign', () => {
    expect(() => buildPresenceCampaign({
      id: 'campaign:pupson', brandId: 'brand:pupsonstuff',
      concept: { id: 'concept:worst-photo', name: 'Worst pet photo challenge', mechanic: 'challenge', thesis: 'Demonstrate the product by transforming difficult pet photos.', hook: 'We gave PupsonStuff the worst dog photos we could find.', evidenceRefs: ['evidence:concept'], targetQuestions: ['Can AI turn a bad dog photo into custom merchandise?'] },
      offers: [{ id: 'offer:pupson', brandId: 'brand:pupsonstuff', name: 'PupsonStuff custom product', kind: 'commerce', objective: 'sale', evidenceRefs: ['evidence:product'] }],
      bridges: [{ fromOfferId: 'offer:pupson', toOfferId: 'offer:unknown', relationship: 'cross_promotion', rationale: 'Invalid external offer.' }],
      createdAt: '2026-09-29T23:50:00-07:00',
    })).toThrow('GROWTH_PRESENCE_BRIDGE_OFFER_UNKNOWN');
  });

  it('keeps citations separate from business conversions in learning summaries', () => {
    const summary = summarizePresenceLearning('campaign:test', [
      { id: 'obs:1', campaignId: 'campaign:test', surface: 'search:ai', queryOrContext: 'custom pet merchandise', observedAt: '2026-09-30T07:00:00Z', outcome: 'cited', evidenceRefs: ['receipt:answer-engine'] },
      { id: 'obs:2', campaignId: 'campaign:test', surface: 'web:owned', queryOrContext: 'campaign landing page', observedAt: '2026-09-30T07:01:00Z', outcome: 'purchased', value: 38, evidenceRefs: ['receipt:order'] },
    ]);

    expect(summary.citations).toBe(1);
    expect(summary.conversions).toBe(1);
    expect(summary.conversionValue).toBe(38);
  });
});

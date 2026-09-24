import { describe, expect, it } from 'vitest';
import { rankSocialDecisionFeed, toSocialDecisionFeedItem } from './social-decision-feed.js';

const opportunity = (id: string, score: number, decision: 'observe' | 'test' | 'escalate') => ({
  id: id as never,
  topic: id,
  score,
  decision,
  components: {},
  evidence: ['evidence-1' as never],
});

describe('social decision feed', () => {
  it('maps escalation to a governed action request', () => {
    const item = toSocialDecisionFeedItem(opportunity('pet portraits', 0.9, 'escalate'));
    expect(item.recommendedCapability).toBe('request_governed_action');
    expect(item.requiresPolicyGate).toBe(true);
  });

  it('maps testing to experiment creation without bypassing governance', () => {
    const item = toSocialDecisionFeedItem(opportunity('pet gifts', 0.6, 'test'));
    expect(item.recommendedCapability).toBe('create_experiment');
    expect(item.requiresPolicyGate).toBe(false);
  });

  it('ranks feed items by opportunity score', () => {
    const feed = rankSocialDecisionFeed([
      opportunity('low', 0.2, 'observe'),
      opportunity('high', 0.9, 'escalate'),
    ]);
    expect(feed.map((item) => item.topic)).toEqual(['high', 'low']);
  });
});

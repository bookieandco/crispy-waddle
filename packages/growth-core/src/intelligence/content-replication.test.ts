import { describe, expect, it } from 'vitest';
import { createOriginalVariantBrief, extractContentPattern } from './content-replication.js';

describe('content pattern replication', () => {
  it('extracts reusable mechanics rather than copying wording', () => {
    const pattern = extractContentPattern({ id: 'post:1' as never, platform: 'instagram', topic: 'dogs', text: 'You need to see this 😂', metrics: { likes: 1000, comments: 80 }, observedAt: '2026-08-30T00:00:00Z' });
    expect(pattern.emotionalMechanism).toBe('humor');
    expect(pattern.audienceTrigger).toBe('engagement');
    expect(pattern.evidence).toContain('likes=1000');
  });

  it('creates an original-variant brief with anti-copy constraints', () => {
    const pattern = extractContentPattern({ id: 'post:2' as never, platform: 'tiktok', topic: 'pets', text: 'How to pick a great gift', metrics: { views: 50000 }, observedAt: '2026-08-30T00:00:00Z' });
    const brief = createOriginalVariantBrief(pattern, { targetAudience: 'pet owners', platform: 'instagram' });
    expect(brief.constraints).toContain('create_original_content');
    expect(brief.constraints).toContain('do_not_reproduce_protected_expression');
  });
});

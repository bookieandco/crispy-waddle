import { describe, expect, it } from 'vitest';
import {
  abstractCreativeMechanic,
  createSocialStoryBankEntry,
  eligibleStoryMaterial,
} from './social-creative-mechanics.js';

describe('Social creative mechanics', () => {
  it('abstracts structure from a viral reference without authorizing expression or identity copying', () => {
    const hypothesis = abstractCreativeMechanic({
      id: 'observation:tiktok:1',
      platform: 'tiktok',
      sourceRef: 'reference:tiktok:1',
      topic: 'music performance',
      hookMechanic: 'story_cold_open',
      hookWindowSeconds: 3,
      retentionBeats: [
        {
          atSecond: 2,
          mechanic: 'open_loop',
          purpose: 'establish unresolved question',
          evidenceRefs: ['retention:2s'],
        },
        {
          atSecond: 8,
          mechanic: 'proof',
          purpose: 'show evidence',
          evidenceRefs: ['retention:8s'],
        },
        {
          atSecond: 18,
          mechanic: 'payoff',
          purpose: 'resolve the setup',
          evidenceRefs: ['retention:18s'],
        },
      ],
      audienceIntent: 'music discovery',
      format: 'short_video',
      performanceEvidenceRefs: ['analytics:viral-reference'],
      observedAt: '2026-10-07T19:00:00.000Z',
    });

    expect(hypothesis.hookMechanic).toBe('story_cold_open');
    expect(hypothesis.retentionBeats.map((beat) => beat.timingBand)).toEqual([
      'opening',
      'early',
      'middle',
    ]);
    expect(hypothesis.sourceExpressionReuseAuthorized).toBe(false);
    expect(hypothesis.identityImitationAuthorized).toBe(false);
    expect(hypothesis.abstractionLaw).toBe('LEARN_STRUCTURE_NOT_EXPRESSION');
  });

  it('stores owner-supplied story material with explicit naming boundaries', () => {
    const publicEntry = createSocialStoryBankEntry({
      id: 'story:moment:1',
      subjectId: 'subject:founder',
      kind: 'moment',
      source: 'owner_interview',
      text: 'The first live customer order arrived during a late-night deploy.',
      happenedAt: '2026-09-30T04:00:00.000Z',
      namingPolicy: 'public',
      evidenceRefs: ['owner-interview:1'],
      recordedAt: '2026-10-07T19:00:00.000Z',
    });
    const restricted = createSocialStoryBankEntry({
      id: 'story:client:restricted',
      subjectId: 'subject:founder',
      kind: 'proof',
      source: 'owner_supplied',
      text: 'Private customer result.',
      namingPolicy: 'restricted',
      evidenceRefs: ['owner-note:restricted'],
      recordedAt: '2026-10-07T19:00:00.000Z',
    });

    expect(publicEntry.publicUseAuthorized).toBe(true);
    expect(restricted.publicUseAuthorized).toBe(false);
    expect(eligibleStoryMaterial([publicEntry, restricted]).map((entry) => entry.id))
      .toEqual(['story:moment:1']);
  });

  it('requires a unit for precise numbers instead of storing context-free metrics', () => {
    expect(() => createSocialStoryBankEntry({
      id: 'story:number:bad',
      subjectId: 'subject:founder',
      kind: 'number',
      source: 'owner_supplied',
      text: 'We improved it.',
      numericValue: 37,
      namingPolicy: 'public',
      evidenceRefs: ['owner-note:1'],
    })).toThrow(/NUMBER_UNIT_REQUIRED/);
  });
});

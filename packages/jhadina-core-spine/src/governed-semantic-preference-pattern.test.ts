import { describe, expect, it } from 'vitest';
import { GovernedSemanticPreferenceStrategy } from './governed-semantic-preference-pattern.js';
import type { Experience, MemoryProposal } from './types.js';

const exp = (content: string): Experience => ({
  id: 'live',
  occurredAt: '2026-09-20T16:00:00.000Z',
  source: 'ask-jhadina',
  actor: 'user',
  content,
  evidence: [{ id: 'live', source: 'ask-jhadina', observedAt: '2026-09-20T16:00:00.000Z', summary: content, immutable: false }],
});

const mem = (id: string, content: string): MemoryProposal => ({
  id: `m-${id}`,
  disposition: 'SAVE',
  content,
  reason: 'approved preference evidence',
  evidence: [{ id, source: 'memory', observedAt: '2026-09-19T16:00:00.000Z', summary: content, immutable: true }],
});

describe('GovernedSemanticPreferenceStrategy', () => {
  it.each([
    ['Be warmer.', 'personality-signal:communication:warmth', 'prefers warm communication'],
    ['Keep it professional.', 'personality-signal:communication:formality', 'prefers formal communication'],
    ['Make it funny.', 'personality-signal:humor:enabled', 'prefers humorous communication'],
    ['You can swear.', 'personality-signal:communication:profanity', 'allows conversational profanity'],
    ['Challenge my assumptions.', 'personality-signal:communication:pushback', 'prefers active pushback'],
    ['Go deeper.', 'personality-signal:communication:technical-depth', 'prefers technical depth'],
    ['Work uninterrupted.', 'personality-signal:preference:continuous-workflow', 'prefers continuous workflow'],
    ['Make it experimental.', 'personality-signal:taste:experimentation', 'prefers experimental creativity'],
    ['Use a familiar tone.', 'personality-signal:relationship:familiar-tone', 'prefers familiar tone'],
  ])('detects %s as a governed semantic hypothesis', (phrase, id, statement) => {
    const [pattern] = new GovernedSemanticPreferenceStrategy().detect(
      exp(phrase),
      [mem('e1', phrase), mem('e2', phrase), mem('e3', phrase)],
    );
    expect(pattern.id).toBe(id);
    expect(pattern.pattern).toBe(statement);
    expect(pattern.evidence.map((ref) => ref.id)).toEqual(['e1', 'e2', 'e3']);
    expect(pattern.personalityEligible).toBe(false);
  });

  it('preserves contradictions instead of silently changing a preference', () => {
    const [pattern] = new GovernedSemanticPreferenceStrategy().detect(
      exp('No humor.'),
      [mem('e1', 'Make it funny.'), mem('c1', 'Keep it serious.')],
    );
    expect(pattern.id).toBe('personality-signal:humor:enabled');
    expect(pattern.evidence.map((ref) => ref.id)).toEqual(['e1']);
    expect(pattern.contradictions.map((ref) => ref.id)).toEqual(['c1']);
  });

  it('does not infer preferences from ordinary task language', () => {
    expect(new GovernedSemanticPreferenceStrategy().detect(
      exp('Audit the repository and run the tests.'),
      [mem('e1', 'The repository contains technical documentation.')],
    )).toEqual([]);
  });

  it('does not promote the mutable current request into durable evidence', () => {
    const [pattern] = new GovernedSemanticPreferenceStrategy().detect(
      exp('Challenge me.'),
      [mem('e1', 'Challenge me.'), mem('e2', 'Push back.'), mem('e3', 'Tell me when I\'m wrong.')],
    );
    expect(pattern.evidence.map((ref) => ref.id)).toEqual(['e1', 'e2', 'e3']);
    expect(pattern.evidence.some((ref) => ref.id === 'live')).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { CommunicationDirectnessPatternStrategy } from './communication-directness-pattern.js';
import type { Experience, MemoryProposal } from './types.js';

const exp = (content: string): Experience => ({
  id: 'live-1',
  occurredAt: '2026-09-20T12:00:00.000Z',
  source: 'ask-jhadina',
  actor: 'user',
  content,
  evidence: [{ id: 'live-1', source: 'ask-jhadina', observedAt: '2026-09-20T12:00:00.000Z', summary: content, immutable: false }],
});

const mem = (id: string, content: string): MemoryProposal => ({
  id: `m-${id}`,
  disposition: 'SAVE',
  content,
  reason: 'approved test memory',
  evidence: [{ id, source: 'memory', observedAt: '2026-09-19T12:00:00.000Z', summary: content, immutable: true }],
});

describe('CommunicationDirectnessPatternStrategy', () => {
  it('emits an explicit semantic family without granting eligibility itself', () => {
    const [pattern] = new CommunicationDirectnessPatternStrategy().detect(
      exp('Keep this direct.'),
      [mem('e1', 'I prefer direct answers.'), mem('e2', 'Be direct when we plan.'), mem('e3', 'Keep it direct.')],
    );
    expect(pattern.id).toBe('personality-signal:communication:directness');
    expect(pattern.personalityDimension).toBe('communication');
    expect(pattern.personalityEligible).toBe(false);
    expect(pattern.occurrences).toBe(4);
    expect(pattern.evidence).toHaveLength(3);
    expect(pattern.contradictions).toEqual([]);
  });

  it('carries explicit opposing statements as contradictions', () => {
    const [pattern] = new CommunicationDirectnessPatternStrategy().detect(
      exp('Keep this direct.'),
      [mem('e1', 'I prefer direct answers.'), mem('c1', 'Be less direct and explain it more.')],
    );
    expect(pattern.occurrences).toBe(3);
    expect(pattern.evidence.map((ref) => ref.id)).toEqual(['e1']);
    expect(pattern.contradictions.map((ref) => ref.id)).toEqual(['c1']);
    expect(pattern.confidence).toBe(3 / 5);
  });

  it('does not infer a personality signal from ordinary prose', () => {
    expect(new CommunicationDirectnessPatternStrategy().detect(
      exp('Build the deployment report.'),
      [mem('e1', 'The report has direct dependencies.')],
    )).toEqual([]);
  });
});

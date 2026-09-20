import { describe, expect, it } from 'vitest';
import { CommunicationConcisionPatternStrategy } from './communication-concision-pattern.js';
import type { Experience, MemoryProposal } from './types.js';

const exp = (content: string): Experience => ({
  id: 'live-1',
  occurredAt: '2026-09-20T15:00:00.000Z',
  source: 'ask-jhadina',
  actor: 'user',
  content,
  evidence: [{ id: 'live-1', source: 'ask-jhadina', observedAt: '2026-09-20T15:00:00.000Z', summary: content, immutable: false }],
});

const mem = (id: string, content: string): MemoryProposal => ({
  id: `m-${id}`,
  disposition: 'SAVE',
  content,
  reason: 'approved test memory',
  evidence: [{ id, source: 'memory', observedAt: '2026-09-19T15:00:00.000Z', summary: content, immutable: true }],
});

describe('CommunicationConcisionPatternStrategy', () => {
  it('recognizes explicit concise-answer preference using durable evidence only', () => {
    const [pattern] = new CommunicationConcisionPatternStrategy().detect(
      exp('Keep this concise.'),
      [mem('e1', 'I prefer brief answers.'), mem('e2', 'Keep answers short.'), mem('e3', 'Be concise.')],
    );

    expect(pattern.id).toBe('personality-signal:communication:concision');
    expect(pattern.pattern).toBe('prefers concise communication');
    expect(pattern.occurrences).toBe(4);
    expect(pattern.evidence.map((ref) => ref.id)).toEqual(['e1', 'e2', 'e3']);
    expect(pattern.personalityEligible).toBe(false);
  });

  it('treats requests for detail as concision contradictions', () => {
    const [pattern] = new CommunicationConcisionPatternStrategy().detect(
      exp('Explain this more.'),
      [mem('e1', 'I prefer brief answers.'), mem('c1', 'Give me detailed answers.')],
    );

    expect(pattern.occurrences).toBe(3);
    expect(pattern.evidence.map((ref) => ref.id)).toEqual(['e1']);
    expect(pattern.contradictions.map((ref) => ref.id)).toEqual(['c1']);
  });

  it('does not infer answer-length preference from ordinary prose', () => {
    expect(new CommunicationConcisionPatternStrategy().detect(
      exp('Audit the deployment report.'),
      [mem('e1', 'The report contains a short identifier.')],
    )).toEqual([]);
  });
});

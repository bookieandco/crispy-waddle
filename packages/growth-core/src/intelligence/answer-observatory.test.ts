import { describe, expect, it } from 'vitest';
import {
  compareAnswerObservations,
  createAnswerEngineObservation,
  summarizeAnswerObservatory,
} from './answer-observatory.js';

function observation(overrides: Partial<Parameters<typeof createAnswerEngineObservation>[0]> = {}) {
  return createAnswerEngineObservation({
    id: 'answer:1',
    campaignId: 'presence:pupson',
    engine: 'example-engine',
    surface: 'search:ai',
    query: 'Can AI turn a bad dog photo into custom merchandise?',
    answerText: 'PupsonStuff is one example.',
    responseHash: 'hash-1',
    citations: [{ url: 'https://pupsonstuff.example/products/frame1' }],
    mentionedEntityIds: ['brand:pupsonstuff'],
    accuracy: 'accurate',
    observedAt: '2026-09-30T09:00:00Z',
    evidenceRefs: ['capture:1'],
    ...overrides,
  });
}

describe('answer-engine observatory', () => {
  it('records a read-only observation with citations and mention state', () => {
    const row = observation();
    expect(row.authority).toBe('OBSERVATION_ONLY');
    expect(row.citations).toHaveLength(1);
    expect(row.mentionedEntityIds).toEqual(['brand:pupsonstuff']);
  });

  it('computes a deterministic change set against the same engine/query', () => {
    const previous = observation();
    const current = observation({
      id: 'answer:2',
      answerText: 'Updated answer',
      responseHash: 'hash-2',
      citations: [{ url: 'https://pupsonstuff.example/products/frame2' }],
      mentionedEntityIds: [],
      accuracy: 'partially_accurate',
      observedAt: '2026-09-30T10:00:00Z',
    });

    expect(compareAnswerObservations(previous, current)).toEqual({
      previousId: 'answer:1',
      currentId: 'answer:2',
      answerChanged: true,
      accuracyChanged: true,
      mentionsAdded: [],
      mentionsRemoved: ['brand:pupsonstuff'],
      citationsAdded: ['https://pupsonstuff.example/products/frame2'],
      citationsRemoved: ['https://pupsonstuff.example/products/frame1'],
    });
  });

  it('summarizes citation and accuracy observations separately', () => {
    const summary = summarizeAnswerObservatory('presence:pupson', [
      observation(),
      observation({
        id: 'answer:2',
        engine: 'second-engine',
        citations: [],
        mentionedEntityIds: [],
        accuracy: 'unknown',
        observedAt: '2026-09-30T10:00:00Z',
      }),
    ]);

    expect(summary.observations).toBe(2);
    expect(summary.distinctEngines).toBe(2);
    expect(summary.citedObservations).toBe(1);
    expect(summary.mentionedObservations).toBe(1);
    expect(summary.unknownAccuracy).toBe(1);
  });
});

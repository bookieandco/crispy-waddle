import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { encodeHippocampalEpisode } from './hippocampus.js';
import { selectEvidenceBackedCallback } from './callback-provenance.js';
import type { Experience, MemoryProposal, PersonalityState } from './types.js';

const callback = 'red-chair';

function personality(overrides: Partial<PersonalityState['relationship']> = {}): PersonalityState {
  return {
    version: 1,
    traits: [],
    voice: {
      directness: 0.8,
      warmth: 0.7,
      humor: 0.7,
      profanityTolerance: 0.6,
      quipFrequency: 0.4,
      verbosity: 0.5,
      disagreementDirectness: 0.7,
    },
    taste: {
      novelty: 0.6,
      experimentation: 0.6,
      conventionTolerance: 0.5,
      aestheticIntensity: 0.6,
      evidence: [],
    },
    relationship: {
      familiarity: 0.8,
      calibrationConfidence: 0.9,
      preferredInteractionModes: [],
      recurringCallbacks: [callback],
      evidence: [],
      ...overrides,
    },
    independentAssessmentRequired: false,
    updatedAt: '2026-09-03T00:00:00.000Z',
  };
}

const evidence = {
  id: 'callback-evidence-1',
  source: 'conversation',
  observedAt: '2026-09-02T00:00:00.000Z',
  summary: 'The red-chair callback came up naturally.',
  immutable: true,
};

describe('evidence-backed callback selector', () => {
  it('accepts a recurring callback backed by Relationship evidence', () => {
    const selected = selectEvidenceBackedCallback({
      personality: personality({ evidence: [evidence] }),
      callback,
    });

    assert.ok(selected);
    assert.equal(selected.value, callback);
    assert.equal(selected.provenance.length, 1);
    assert.equal(selected.provenance[0]?.origin, 'relationship');
    assert.equal(selected.provenance[0]?.evidence.id, 'callback-evidence-1');
  });

  it('rejects an invented callback even when unrelated evidence exists', () => {
    const selected = selectEvidenceBackedCallback({
      personality: personality({ evidence: [evidence] }),
      callback: 'invented-callback',
    });

    assert.equal(selected, undefined);
  });

  it('does not let broad Relationship evidence prove a specific callback', () => {
    const selected = selectEvidenceBackedCallback({
      personality: personality({
        evidence: [{
          ...evidence,
          id: 'broad-evidence',
          summary: 'The user and Jhadina have shared history.',
        }],
      }),
      callback,
    });

    assert.equal(selected, undefined);
  });

  it('accepts only SAVE memory provenance with pattern-specific evidence', () => {
    const memory: MemoryProposal = {
      id: 'memory-1',
      content: 'The red-chair callback is a recurring shared reference.',
      reason: 'approved callback memory',
      disposition: 'SAVE',
      evidence: [evidence],
    };
    const selected = selectEvidenceBackedCallback({
      personality: personality(),
      callback,
      memories: [memory],
    });

    assert.ok(selected);
    assert.equal(selected.provenance[0]?.origin, 'memory');

    const pending = { ...memory, disposition: 'PROPOSE' as const };
    assert.equal(
      selectEvidenceBackedCallback({ personality: personality(), callback, memories: [pending] }),
      undefined,
    );
  });

  it('can trace a callback directly to a Hippocampus episode without inventing evidence', () => {
    const experience: Experience = {
      id: 'experience-red-chair',
      occurredAt: '2026-09-01T00:00:00.000Z',
      source: 'conversation',
      actor: 'user',
      content: 'We made the red-chair callback again.',
      evidence: [],
    };
    const episode = encodeHippocampalEpisode(experience);

    const selected = selectEvidenceBackedCallback({
      personality: personality(),
      callback,
      episodes: [episode],
    });

    assert.ok(selected);
    assert.equal(selected.provenance[0]?.origin, 'hippocampus');
    assert.equal(selected.provenance[0]?.evidence.id, 'experience-red-chair');
    assert.equal(selected.provenance[0]?.evidence.immutable, true);
  });

  it('deduplicates reused evidence across provenance sources', () => {
    const memory: MemoryProposal = {
      id: 'memory-duplicate',
      content: 'red-chair callback',
      reason: 'duplicate source',
      disposition: 'SAVE',
      evidence: [evidence],
    };
    const selected = selectEvidenceBackedCallback({
      personality: personality({ evidence: [evidence] }),
      callback,
      memories: [memory],
    });

    assert.ok(selected);
    assert.equal(selected.provenance.length, 1);
  });
});

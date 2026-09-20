import assert from 'node:assert/strict';
import { createPatternPort, RecurrencePatternStrategy } from './pattern-engine.js';
import type { Experience, MemoryProposal } from './types.js';

const experience: Experience = {
  id: 'experience-1',
  occurredAt: '2026-09-02T01:00:00.000Z',
  source: 'conversation',
  actor: 'user',
  content: 'User prefers direct communication in planning conversations.',
  evidence: [],
  metadata: { test: true },
};

const memories: MemoryProposal[] = [
  {
    id: 'memory-1',
    content: 'User prefers direct communication when making plans.',
    reason: 'approved preference evidence',
    evidence: [{
      id: 'evidence-1',
      source: 'conversation',
      observedAt: '2026-09-01T01:00:00.000Z',
      summary: 'User explicitly preferred direct communication.',
      immutable: true,
    }],
    disposition: 'SAVE',
  },
  {
    id: 'memory-2',
    content: 'User enjoys concise planning.',
    reason: 'pending candidate',
    evidence: [],
    disposition: 'PROPOSE',
  },
];

describe('deterministic PatternPort', () => {
  it('detects recurrence from pattern-specific SAVE memory evidence and projects Bayesian confidence', async () => {
    const port = createPatternPort();
    const patterns = await port.detect(experience, memories);

    assert.ok(patterns.length > 0);
    const direct = patterns.find((pattern) => pattern.id === 'recurrence:direct');
    assert.ok(direct);
    assert.equal(direct.personalityEligible, false);
    assert.equal(direct.personalityDimension, undefined);
    assert.equal(direct.occurrences, 2);
    assert.equal(direct.confidence, 3 / 4);
    assert.deepEqual(direct.evidence.map((ref) => ref.id), ['experience-1', 'evidence-1']);
    assert.deepEqual(direct.contradictions, []);
  });

  it('does not use non-SAVE memory proposals as recurrence evidence', async () => {
    const strategy = new RecurrencePatternStrategy();
    const patterns = strategy.detect(experience, [memories[1]]);
    assert.deepEqual(patterns, []);
  });

  it('does not attribute unrelated SAVE evidence to a recurring term', () => {
    const unrelatedSave: MemoryProposal = {
      id: 'memory-unrelated-evidence',
      content: 'User prefers direct communication and likes detailed planning.',
      reason: 'approved memory with mixed evidence',
      evidence: [{
        id: 'evidence-unrelated',
        source: 'conversation',
        observedAt: '2026-08-31T01:00:00.000Z',
        summary: 'User asked for a detailed planning checklist.',
        immutable: true,
      }],
      disposition: 'SAVE',
    };

    const patterns = new RecurrencePatternStrategy().detect(experience, [memories[0], unrelatedSave]);
    const direct = patterns.find((pattern) => pattern.id === 'recurrence:direct');

    assert.ok(direct);
    assert.deepEqual(direct.evidence.map((ref) => ref.id), ['experience-1', 'evidence-1']);
    assert.equal(direct.occurrences, 2);
    assert.equal(direct.confidence, 3 / 4);
  });

  it('requires historical evidence itself to support the recurring term', () => {
    const broadSave: MemoryProposal = {
      id: 'memory-broad',
      content: 'User prefers direct communication.',
      reason: 'proposal text is more specific than its evidence',
      evidence: [{
        id: 'evidence-broad',
        source: 'conversation',
        observedAt: '2026-08-30T01:00:00.000Z',
        summary: 'User discussed planning.',
        immutable: true,
      }],
      disposition: 'SAVE',
    };

    const patterns = new RecurrencePatternStrategy().detect(experience, [broadSave]);
    assert.equal(patterns.some((pattern) => pattern.id === 'recurrence:direct'), false);
  });

  it('counts one approved memory as one Bayesian observation even when it has multiple supporting refs', () => {
    const multiRefSave: MemoryProposal = {
      id: 'memory-multi-ref',
      content: 'User prefers direct communication.',
      reason: 'one memory proposal backed by multiple refs',
      evidence: [
        {
          id: 'evidence-multi-1',
          source: 'conversation',
          observedAt: '2026-08-29T01:00:00.000Z',
          summary: 'User preferred direct answers.',
          immutable: true,
        },
        {
          id: 'evidence-multi-2',
          source: 'conversation',
          observedAt: '2026-08-29T01:05:00.000Z',
          summary: 'Direct communication was explicitly requested.',
          immutable: true,
        },
      ],
      disposition: 'SAVE',
    };

    const patterns = new RecurrencePatternStrategy().detect(experience, [multiRefSave]);
    const direct = patterns.find((pattern) => pattern.id === 'recurrence:direct');

    assert.ok(direct);
    assert.equal(direct.occurrences, 2);
    assert.equal(direct.confidence, 3 / 4);
    assert.deepEqual(
      direct.evidence.map((ref) => ref.id),
      ['experience-1', 'evidence-multi-1', 'evidence-multi-2'],
    );
  });

  it('carries explicit contradiction observations into Bayesian confidence and contradiction provenance', () => {
    const contradiction: MemoryProposal = {
      id: 'memory-contradiction',
      content: 'User requested not direct communication in this context.',
      reason: 'approved contradictory observation',
      evidence: [{
        id: 'evidence-contradiction',
        source: 'conversation',
        observedAt: '2026-08-28T01:00:00.000Z',
        summary: 'User explicitly requested not direct communication.',
        immutable: true,
      }],
      disposition: 'SAVE',
    };

    const patterns = new RecurrencePatternStrategy().detect(experience, [memories[0], contradiction]);
    const direct = patterns.find((pattern) => pattern.id === 'recurrence:direct');

    assert.ok(direct);
    assert.equal(direct.occurrences, 3);
    assert.equal(direct.confidence, 3 / 5);
    assert.deepEqual(direct.evidence.map((ref) => ref.id), ['experience-1', 'evidence-1']);
    assert.deepEqual(direct.contradictions.map((ref) => ref.id), ['evidence-contradiction']);
    assert.equal(direct.personalityEligible, false);
  });

  it('does not double-count the same evidence reused by multiple memories', () => {
    const duplicatedEvidence = {
      id: 'evidence-shared',
      source: 'conversation',
      observedAt: '2026-08-27T01:00:00.000Z',
      summary: 'User requested direct communication.',
      immutable: true,
    };
    const duplicateMemories: MemoryProposal[] = [
      {
        id: 'memory-shared-1',
        content: 'User prefers direct communication.',
        reason: 'first proposal over shared source evidence',
        evidence: [duplicatedEvidence],
        disposition: 'SAVE',
      },
      {
        id: 'memory-shared-2',
        content: 'Direct communication is preferred.',
        reason: 'duplicate proposal over the same source evidence',
        evidence: [{ ...duplicatedEvidence }],
        disposition: 'SAVE',
      },
    ];

    const patterns = new RecurrencePatternStrategy().detect(experience, duplicateMemories);
    const direct = patterns.find((pattern) => pattern.id === 'recurrence:direct');

    assert.ok(direct);
    assert.equal(direct.occurrences, 2);
    assert.equal(direct.confidence, 3 / 4);
    assert.deepEqual(direct.evidence.map((ref) => ref.id), ['experience-1', 'evidence-shared']);
  });

  it('does not mutate the experience or memories', async () => {
    const beforeExperience = structuredClone(experience);
    const beforeMemories = structuredClone(memories);
    const port = createPatternPort();

    await port.detect(experience, memories);

    assert.deepEqual(experience, beforeExperience);
    assert.deepEqual(memories, beforeMemories);
  });
});

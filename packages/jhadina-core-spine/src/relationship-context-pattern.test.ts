import assert from 'node:assert/strict';
import { RelationshipContextPatternStrategy } from './relationship-context-pattern.js';
import type { Experience, MemoryProposal } from './types.js';

const experience: Experience = {
  id: 'experience-context-1',
  occurredAt: '2026-09-02T22:00:00.000Z',
  source: 'conversation',
  domain: 'planning',
  actor: 'user',
  content: 'We are planning the next move.',
  evidence: [],
};

const savedMemory: MemoryProposal = {
  id: 'memory-context-1',
  content: 'Earlier planning conversation.',
  reason: 'approved contextual memory',
  evidence: [{
    id: 'evidence-context-1',
    source: 'conversation',
    observedAt: '2026-09-01T22:00:00.000Z',
    summary: 'Earlier conversation about planning.',
    immutable: true,
  }],
  disposition: 'SAVE',
};

describe('RelationshipContextPatternStrategy', () => {
  it('detects recurring interaction context from approved evidence', () => {
    const patterns = new RelationshipContextPatternStrategy().detect(experience, [savedMemory]);
    assert.equal(patterns.length, 1);
    assert.equal(patterns[0].personalityDimension, 'relationship');
    assert.equal(patterns[0].personalityEligible, false);
    assert.equal(patterns[0].id, 'relationship-context:actor=user|source=conversation|domain=planning');
    assert.deepEqual(patterns[0].evidence.map((ref) => ref.id), ['experience-context-1', 'evidence-context-1']);
  });

  it('does not infer relationship structure from pending proposals', () => {
    const pending = { ...savedMemory, disposition: 'PROPOSE' as const };
    assert.deepEqual(new RelationshipContextPatternStrategy().detect(experience, [pending]), []);
  });

  it('does not invent a relationship signal when evidence comes from another source', () => {
    const otherSource = {
      ...savedMemory,
      evidence: savedMemory.evidence.map((ref) => ({ ...ref, source: 'email' })),
    };
    assert.deepEqual(new RelationshipContextPatternStrategy().detect(experience, [otherSource]), []);
  });
});

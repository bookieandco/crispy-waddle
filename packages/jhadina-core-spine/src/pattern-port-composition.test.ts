import assert from 'node:assert/strict';
import { createCanonicalPatternPort } from './pattern-port-composition.js';
import type { Experience, MemoryProposal } from './types.js';

const experience: Experience = {
  id: 'experience-1',
  occurredAt: '2026-09-03T00:00:00.000Z',
  source: 'chat',
  actor: 'user',
  content: 'I prefer direct answers about music',
  domain: 'music',
  evidence: [],
};

const memory: MemoryProposal = {
  id: 'memory-1',
  content: 'I prefer direct answers about music',
  reason: 'approved preference',
  disposition: 'SAVE',
  evidence: [{
    id: 'memory-evidence-1',
    source: 'chat',
    observedAt: '2026-09-02T00:00:00.000Z',
    summary: 'user prefers direct answers about music',
    immutable: true,
  }],
};

describe('Canonical PatternPort composition', () => {
  it('runs multiple strategies behind one PatternPort boundary', async () => {
    const port = createCanonicalPatternPort();
    const observations = await port.detect(experience, [memory]);

    assert.ok(observations.length > 0);
    assert.ok(observations.some((item) => item.id.startsWith('recurrence:')));
    assert.ok(observations.some((item) => item.id.startsWith('relationship-context:')));
    assert.ok(observations.every((item) => item.personalityEligible !== true));
  });
});

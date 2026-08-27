import { describe, expect, it } from 'vitest';
import { memoryProposalToExperience } from './memory-experience-adapter.js';

const proposal = {
  id: 'memory-1',
  content: 'User prefers concise answers.',
  reason: 'Repeated feedback',
  evidence: [{ id: 'evidence-1', source: 'feedback' }],
  disposition: 'SAVE',
} as never;

describe('Memory → Experience adapter', () => {
  it('records proposals without treating them as saved memory', () => {
    const event = memoryProposalToExperience(proposal, 'proposed');
    expect(event.eventType).toBe('memory.proposed');
    expect(event.outcome).toBe('proposed');
  });

  it('records approval only when the lifecycle stage is approved', () => {
    const event = memoryProposalToExperience(proposal, 'approved', { actor: 'user-1' });
    expect(event.eventType).toBe('memory.approved');
    expect(event.outcome).toBe('approved');
    expect(event.actor).toBe('user-1');
  });

  it('cannot represent rejection as approval', () => {
    const event = memoryProposalToExperience({ ...proposal, disposition: 'IGNORE' } as never, 'rejected');
    expect(event.eventType).toBe('memory.rejected');
    expect(event.outcome).toBe('rejected');
    expect(event.eventType).not.toBe('memory.approved');
  });

  it('preserves evidence and provenance without storing the memory content', () => {
    const event = memoryProposalToExperience(proposal, 'proposed');
    expect(event.evidence).toEqual(proposal.evidence);
    expect(event.provenance.sourceId).toBe('memory-1');
    expect(event.sensitivity).toBe('sensitive');
    expect(event.content).not.toContain(proposal.content);
  });
});

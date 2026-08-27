import type { MemoryProposal } from './types.js';
import { createExperienceEvent, type ExperienceEvent } from './experience.js';

export type MemoryExperienceStage = 'proposed' | 'approved' | 'rejected';

export function memoryProposalToExperience(
  proposal: MemoryProposal,
  stage: MemoryExperienceStage,
  input: { actor?: string; occurredAt?: string; correlationId?: string } = {},
): ExperienceEvent {
  const eventType = `memory.${stage}` as ExperienceEvent['eventType'];
  const outcome = stage === 'proposed' ? 'proposed' : stage === 'approved' ? 'approved' : 'rejected';

  return createExperienceEvent({
    id: `memory:${proposal.id}:${stage}`,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    source: 'memory-core',
    domain: 'memory',
    actor: input.actor ?? 'system',
    content: stage === 'approved'
      ? 'Memory proposal approved.'
      : stage === 'rejected'
        ? 'Memory proposal rejected.'
        : 'Memory proposal observed.',
    eventType,
    outcome,
    correlationId: input.correlationId ?? proposal.id,
    evidence: proposal.evidence,
    provenance: { sourceId: proposal.id, sourceType: 'memory-proposal' },
    sensitivity: 'sensitive',
    metadata: { disposition: proposal.disposition },
  });
}

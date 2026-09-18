import type { ViewingSignal } from './index';

export interface ViewingMemoryProposal {
  readonly id: string;
  readonly kind: 'media-preference';
  readonly titleId: string;
  readonly signalKind: NonNullable<ViewingSignal['kind']>;
  readonly evidence: ViewingSignal;
  readonly requiresApproval: true;
}

export interface ViewingMemoryProposalPort {
  propose(proposal: ViewingMemoryProposal): Promise<void>;
}

export function toViewingMemoryProposal(signal: ViewingSignal): ViewingMemoryProposal | null {
  if (!signal.kind || signal.kind === 'temporary-intent' || signal.kind === 'contextual') return null;
  return {
    id: `media-preference:${signal.titleId}:${signal.observedAt ?? 'unknown'}`,
    kind: 'media-preference',
    titleId: signal.titleId,
    signalKind: signal.kind,
    evidence: { ...signal },
    requiresApproval: true,
  };
}

export async function proposeViewingMemory(signal: ViewingSignal, port: ViewingMemoryProposalPort): Promise<ViewingMemoryProposal | null> {
  const proposal = toViewingMemoryProposal(signal);
  if (proposal) await port.propose(proposal);
  return proposal;
}

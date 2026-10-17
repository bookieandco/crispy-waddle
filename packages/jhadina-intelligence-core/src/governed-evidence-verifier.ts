import type { DecisionProposal } from '@jhadina/core-spine';
import { bindProposalEvidenceToContext, collectContextEvidence } from './evidence-binding.js';
import type { IntelligenceProposalVerifier, CompiledIntelligenceContext } from './intelligence-fabric.js';

/**
 * Opt-in strict admission backed by current main's full canonical evidence
 * coverage, including Social, Growth, Money, personality and artifacts.
 * Never upgrades a DecisionProposal or grants an action capability.
 */
export class GovernedEvidenceVerifier implements IntelligenceProposalVerifier {
  async verify(proposal: DecisionProposal, context: CompiledIntelligenceContext): Promise<DecisionProposal> {
    if (proposal.contextId !== context.packet.id) throw new Error('FABRIC_PROPOSAL_CONTEXT_MISMATCH');
    const allowed = new Set(collectContextEvidence(context.packet).map(ref => ref.id));
    const denied = proposal.evidence.filter(ref => !allowed.has(ref.id)).map(ref => ref.id);
    const rebound = bindProposalEvidenceToContext(proposal, context.packet);
    if (!denied.length) return rebound;
    return {
      ...rebound, disposition: 'DEFER',
      uncertainty: [
        ...rebound.uncertainty,
        `Unverified provider evidence ids: ${[...new Set(denied)].sort().join(', ')}`,
      ],
    };
  }
}

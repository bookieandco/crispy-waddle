export type SecurityChangeMode = 'tighten' | 'quarantine' | 'revoke' | 'observe';

export type SecurityThreatSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface SecurityObservation {
  id: string;
  source: string;
  category: string;
  severity: SecurityThreatSeverity;
  summary: string;
  evidenceHash: string;
  observedAt: string;
}

export interface SecurityChangeProposal {
  id: string;
  observationId: string;
  mode: SecurityChangeMode;
  target: string;
  currentVersion: string;
  proposedVersion: string;
  rationale: string;
  reversible: boolean;
  generatedAt: string;
}

export interface SecurityEvolutionDecision {
  decision: 'allow' | 'deny' | 'approval_required';
  reason: string;
}

/**
 * Security evolution is intentionally asymmetric: defensive tightening can be
 * proposed automatically, while weakening/removing a safeguard always needs
 * owner approval. This class contains no persistence or deployment authority.
 */
export class SecurityEvolutionEngine {
  evaluate(proposal: SecurityChangeProposal): SecurityEvolutionDecision {
    if (!proposal.id || !proposal.observationId || !proposal.target) {
      return { decision: 'deny', reason: 'invalid_security_change_proposal' };
    }
    if (!proposal.reversible) {
      return { decision: 'approval_required', reason: 'security_change_is_not_reversible' };
    }

    switch (proposal.mode) {
      case 'tighten':
      case 'quarantine':
      case 'revoke':
        return {
          decision: 'approval_required',
          reason: 'security_changes_require_independent_owner_approved_promotion',
        };
      case 'observe':
        return { decision: 'allow', reason: 'observation_only_has_no_security_side_effect' };
      default:
        return { decision: 'deny', reason: 'unknown_security_change_mode' };
    }
  }

  /** A weakening operation is never auto-authorized by this engine. */
  evaluateWeakening(): SecurityEvolutionDecision {
    return {
      decision: 'deny',
      reason: 'security_guarantees_may_not_be_weakened_by_autonomous_evolution',
    };
  }
}

export function createSecurityObservation(input: Omit<SecurityObservation, 'id' | 'observedAt'>): SecurityObservation {
  return {
    ...input,
    id: crypto.randomUUID(),
    observedAt: new Date().toISOString(),
  };
}

export function createSecurityChangeProposal(
  input: Omit<SecurityChangeProposal, 'id' | 'generatedAt'>,
): SecurityChangeProposal {
  return {
    ...input,
    id: crypto.randomUUID(),
    generatedAt: new Date().toISOString(),
  };
}

export interface EvidenceRef {
  id: string;
  source: string;
  observedAt: string;
  summary: string;
  immutable?: boolean;
}

export interface PatternObservation {
  id: string;
  category: string;
  description: string;
  confidence: number;
  stability: number;
  evidence: EvidenceRef[];
  contradictions: EvidenceRef[];
  status: 'candidate' | 'accepted' | 'contested' | 'retired';
}

export interface PersonalityTrait {
  name: string;
  category: 'preference' | 'value' | 'tendency' | 'communication' | 'decision';
  confidence: number;
  stability: number;
  evidence: EvidenceRef[];
  contradictions: EvidenceRef[];
  status: 'candidate' | 'accepted' | 'contested' | 'retired';
}

export interface PersonalityState {
  version: number;
  traits: PersonalityTrait[];
  independentAssessmentRequired: boolean;
  updatedAt: string;
}

/**
 * Regret context is deliberately separate from canonical memories/knowledge.
 * It is a learning signal, not a fact, policy, approval, or authority source.
 */
export interface RegretContext {
  memoryId: string;
  score: number;
  subjectType: string;
  subjectId: string;
  discrepancy: string;
  rootCause?: string;
  recurrenceCount: number;
  status: string;
  salience: number;
}

export interface ContextPacket {
  id: string;
  purpose: string;
  userGoal?: string;
  relevantMemories: EvidenceRef[];
  patterns: PatternObservation[];
  personality: PersonalityState;
  knowledge: EvidenceRef[];
  /** Historical learning signals only; never treated as canonical facts. */
  regretContext?: RegretContext[];
  constraints: string[];
  excludedContext: string[];
}

export type DecisionDisposition = 'informational' | 'recommendation' | 'proposed_action';

export interface DecisionProposal {
  id: string;
  contextId: string;
  disposition: DecisionDisposition;
  recommendation: string;
  rationale: string;
  evidence: EvidenceRef[];
  uncertainty: string[];
  alternatives: string[];
}

export interface PolicyDecision {
  id: string;
  proposalId: string;
  allowed: boolean;
  reason: string;
  requiredApproval: boolean;
  evaluatedAt: string;
}

export interface ActionRequest {
  id: string;
  proposalId: string;
  capability: string;
  operation: string;
  input: unknown;
  reversible: boolean;
  consequenceLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface ActionResult {
  id: string;
  requestId: string;
  success: boolean;
  output: unknown;
  evidence: EvidenceRef[];
  completedAt: string;
}

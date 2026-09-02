export type CoreDomain =
  | 'identity'
  | 'memory'
  | 'pattern'
  | 'personality'
  | 'context'
  | 'knowledge'
  | 'values'
  | 'policy'
  | 'capability'
  | 'action'
  | 'audit'
  | 'evolution';

export type DecisionDisposition = 'PROCEED' | 'ASK' | 'DECLINE' | 'DEFER';

export type MemoryDisposition = 'PROPOSE' | 'SAVE' | 'IGNORE';

export interface EvidenceRef {
  id: string;
  source: string;
  observedAt: string;
  summary: string;
  immutable?: boolean;
}

export interface Experience {
  id: string;
  occurredAt: string;
  source: string;
  domain?: string;
  actor: 'user' | 'jhadina' | 'system' | 'external';
  content: string;
  evidence: EvidenceRef[];
}

export interface PatternObservation {
  id: string;
  pattern: string;
  evidence: EvidenceRef[];
  confidence: number;
  occurrences: number;
  contradictions: EvidenceRef[];
  lastObservedAt: string;
}

/**
 * Personality is evidence-backed state, not a prompt or a fixed persona.
 * It may contain preferences and tendencies, but every durable claim needs
 * provenance and can be contradicted or revised.
 */
export interface PersonalityTrait {
  id: string;
  statement: string;
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

export interface ContextPacket {
  id: string;
  purpose: string;
  userGoal?: string;
  relevantMemories: EvidenceRef[];
  patterns: PatternObservation[];
  personality: PersonalityState;
  knowledge: EvidenceRef[];
  constraints: string[];
  excludedContext: string[];
}

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

/**
 * Result produced by an ActionPort after the canonical policy decision has
 * already authorized execution. Policy decisions and action requests live in
 * canonical-action.ts so there is only one authoritative governance model.
 */
export interface ActionResult {
  id: string;
  requestId: string;
  success: boolean;
  output?: unknown;
  error?: string;
  completedAt: string;
}

export interface AuditEvent {
  id: string;
  type: string;
  occurredAt: string;
  actor: string;
  subjectId: string;
  payload: Record<string, unknown>;
}

export interface MemoryProposal {
  id: string;
  content: string;
  reason: string;
  evidence: EvidenceRef[];
  disposition: MemoryDisposition;
}

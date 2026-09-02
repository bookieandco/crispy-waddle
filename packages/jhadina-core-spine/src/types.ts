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

/** Personality never owns identity, values, authority, or policy. */
export type PersonalityDimension =
  | 'temperament'
  | 'communication'
  | 'preference'
  | 'tendency'
  | 'humor'
  | 'opinion'
  | 'taste'
  | 'relationship';

export type PersonalityTraitStatus = 'candidate' | 'accepted' | 'contested' | 'retired';

export interface PersonalityTrait {
  id: string;
  statement: string;
  dimension: PersonalityDimension;
  confidence: number;
  stability: number;
  evidence: EvidenceRef[];
  contradictions: EvidenceRef[];
  status: PersonalityTraitStatus;
  firstObservedAt: string;
  lastObservedAt: string;
  revision: number;
}

/** Durable expression preferences derived from personality, never authority. */
export interface PersonalityVoiceState {
  directness: number;
  warmth: number;
  humor: number;
  profanityTolerance: number;
  quipFrequency: number;
  verbosity: number;
  disagreementDirectness: number;
}

/** Durable taste preferences are distinct from generic personality traits. */
export interface PersonalityTasteState {
  novelty: number;
  experimentation: number;
  conventionTolerance: number;
  aestheticIntensity: number;
  evidence: EvidenceRef[];
}

/** Interaction history summary; not a claim of authority or emotional dependency. */
export interface PersonalityRelationshipState {
  familiarity: number;
  calibrationConfidence: number;
  preferredInteractionModes: string[];
  recurringCallbacks: string[];
  evidence: EvidenceRef[];
}

/**
 * Personality is evidence-backed state, not a prompt or a fixed persona.
 * Values remain in Values Core. Identity remains in Identity Core.
 */
export interface PersonalityState {
  version: number;
  traits: PersonalityTrait[];
  voice: PersonalityVoiceState;
  taste: PersonalityTasteState;
  relationship: PersonalityRelationshipState;
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

export interface SpineCycle {
  experience: Experience;
  patterns: PatternObservation[];
  personality: PersonalityState;
  context: ContextPacket;
  decision?: DecisionProposal;
  policy?: PolicyDecision;
  action?: ActionRequest;
  result?: ActionResult;
  memoryProposals: MemoryProposal[];
  auditEvents: AuditEvent[];
}

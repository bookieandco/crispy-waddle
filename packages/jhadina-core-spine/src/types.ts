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
  recordedAt?: string;
  createdAt?: string;
  source: string;
  domain?: string;
  actor: 'user' | 'jhadina' | 'system' | 'external';
  outcome?: string;
  correlationId?: string;
  causationId?: string;
  sensitivity?: string;
  provenance?: Record<string, unknown>;
  content: string;
  evidence: EvidenceRef[];
  metadata?: Record<string, unknown>;
}

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

export interface PatternObservation {
  id: string;
  pattern: string;
  evidence: EvidenceRef[];
  confidence: number;
  occurrences: number;
  contradictions: EvidenceRef[];
  lastObservedAt: string;
  personalityEligible?: boolean;
  personalityDimension?: PersonalityDimension;
}

export interface PersonalityTrait {
  id: string;
  statement: string;
  /** Legacy mainline field retained during migration to governed dimensions. */
  category?: 'preference' | 'value' | 'tendency' | 'communication' | 'decision';
  /** Governed v2 dimension. New personality projection always writes this. */
  dimension?: PersonalityDimension;
  confidence: number;
  stability: number;
  evidence: EvidenceRef[];
  contradictions: EvidenceRef[];
  status: PersonalityTraitStatus;
  firstObservedAt?: string;
  lastObservedAt?: string;
  revision?: number;
}

export interface PersonalityVoiceState {
  directness: number;
  warmth: number;
  humor: number;
  profanityTolerance: number;
  quipFrequency: number;
  verbosity: number;
  disagreementDirectness: number;
}

export interface PersonalityTasteState {
  novelty: number;
  experimentation: number;
  conventionTolerance: number;
  aestheticIntensity: number;
  evidence: EvidenceRef[];
}

export interface PersonalityRelationshipState {
  familiarity: number;
  calibrationConfidence: number;
  preferredInteractionModes: string[];
  recurringCallbacks: string[];
  evidence: EvidenceRef[];
}

export interface PersonalityState {
  version: number;
  traits: PersonalityTrait[];
  /**
   * Optional only for mainline migration compatibility. Governed v2 state
   * constructors and persistence always materialize these submodels.
   */
  voice?: PersonalityVoiceState;
  taste?: PersonalityTasteState;
  relationship?: PersonalityRelationshipState;
  independentAssessmentRequired: boolean;
  updatedAt: string;
}

/** Provider-neutral spatial context contribution. It is contextual intelligence, never an authority boundary. */
export interface SpatialDomainContext {
  observations: EvidenceRef[];
  evidence: EvidenceRef[];
  claims: EvidenceRef[];
  reality: EvidenceRef[];
  attention: EvidenceRef[];
  conflicts: string[];
  uncertainty: string[];
  limitations: string[];
  provenance: EvidenceRef[];
}

/** Domain extensions are additive; existing ContextPacket consumers remain valid. */
export interface DomainContext {
  spatial?: SpatialDomainContext;
}

/**
 * Deterministic presentation directive supplied to the model as context.
 * It is descriptive only: it grants no authority and cannot mutate
 * Personality, Values, Policy, Identity, security, or execution permission.
 */
export interface ExpressionDirective {
  mode: 'direct' | 'explanatory' | 'pushback' | 'clarifying' | 'serious';
  allowProfanity: boolean;
  allowQuip: boolean;
  /** Governed presentation target; never permission to omit required facts. */
  responseLength?: 'brief' | 'balanced' | 'detailed';
  tone?: 'warm' | 'conversational' | 'formal';
  reasoningDepth?: 'simple' | 'standard' | 'technical';
  /** Presentation pacing only. It never grants permission to execute actions. */
  interactionStyle?: 'checkpointed' | 'balanced' | 'continuous';
  creativeStyle?: 'conventional' | 'balanced' | 'experimental';
  callback?: string;
  callbackProvenance?: Array<{
    origin: 'relationship' | 'memory' | 'hippocampus';
    evidence: EvidenceRef;
  }>;
  culturalReference?: string;
  culturalReferenceEvidence?: EvidenceRef[];
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
  domainContext?: DomainContext;
  expressionDirective?: ExpressionDirective;
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

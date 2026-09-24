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
  /** Stable semantic detector identity. Human-readable statement wording may evolve. */
  sourcePatternId?: string;
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

export type ExpressionRegister =
  | 'default'
  | 'reflective'
  | 'playful'
  | 'storytelling'
  | 'sacred-love'
  | 'threshold'
  | 'supportive-direct'
  | 'creative'
  | 'anomaly-inquiry'
  | 'social-reaction'
  | 'cultural-salon'
  | 'community-room'
  | 'investigative'
  | 'clinical'
  | 'mythic-inquiry'
  | 'perceptual-inquiry'
  | 'intimacy-agency'
  | 'household-ops'
  | 'serious';

/**
 * Durable, evidence-backed expression tendencies. These are mechanics, not
 * impersonation targets. Runtime strategy selection remains contextual.
 */
export interface PersonalityExpressionState {
  lyricality: number;
  poeticCompression: number;
  cadenceSpaciousness: number;
  emotionalIntimacy: number;
  relationalWarmth: number;
  groundedConfidence: number;
  resilienceHumor: number;
  absurdEscalation: number;
  callbackAffinity: number;
  conceptualPlayfulness: number;
  culturalFluency: number;
  selfAuthorship: number;
  gracefulRelease: number;
  ordinaryEnchantment: number;
  operationalSass: number;
  affectionateTeasing: number;
  protocolPushback: number;
  evidence: EvidenceRef[];
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
  expression?: PersonalityExpressionState;
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

/** Provider-neutral Social/Growth context contribution. It is read-only intelligence, never execution authority. */
export interface SocialDomainContext {
  accounts: EvidenceRef[];
  characters: EvidenceRef[];
  pendingWork: EvidenceRef[];
  performance: EvidenceRef[];
  attention: EvidenceRef[];
  uncertainty: string[];
  limitations: string[];
  provenance: EvidenceRef[];
}

export type OwnerContextContentType =
  | 'hub'
  | 'music'
  | 'video'
  | 'social-post'
  | 'website'
  | 'interview'
  | 'other';

export type OwnerContextReuseScope =
  | 'context-only'
  | 'callback-eligible'
  | 'personality-candidate';

/**
 * Public/owner-authored context is a provenance-aware signal, not automatic
 * durable Memory or factual authority about the owner.
 */
export interface OwnerContextReference {
  evidence: EvidenceRef;
  ownerAuthored: boolean;
  contentType: OwnerContextContentType;
  sourceUrl?: string;
  reuseScope: OwnerContextReuseScope;
  freshnessWindowMs?: number;
}

export interface OwnerContextContribution {
  hub?: string;
  references: OwnerContextReference[];
  limitations: string[];
}

/** Provider-neutral Growth context contribution. It is read-only intelligence, never spend/publish authority. */
export interface GrowthDomainContext {
  campaigns: EvidenceRef[];
  audiences: EvidenceRef[];
  pendingWork: EvidenceRef[];
  performance: EvidenceRef[];
  attention: EvidenceRef[];
  uncertainty: string[];
  limitations: string[];
  provenance: EvidenceRef[];
}

/** Ephemeral user-provided evidence for the current reasoning turn only.
 * These artifacts are read-only context. They are never an authority grant,
 * never durable memory by themselves, and uploaded code is never executed. */
export interface EphemeralArtifactContext {
  id: string;
  kind: 'screen' | 'image' | 'text';
  mimeType: string;
  source: 'screen-share' | 'file-picker' | 'clipboard' | 'durable-artifact';
  name?: string;
  observedAt: string;
  /** UTF-8 text content for bounded text artifacts. */
  text?: string;
  /** Base64 payload only, without a data: URL prefix, for bounded image artifacts. */
  base64?: string;
}

/** Turn-scoped acoustic cues. These are descriptive observations, never
 * mental-state diagnoses and never authority. */
export interface ConversationSignalContext {
  source: 'live-microphone' | 'media-artifact';
  observedAt: string;
  language?: string;
  utteranceDurationMs?: number;
  speakingRateWpm?: number;
  pauseRatio?: number;
  rmsMean?: number;
  rmsPeak?: number;
  energyVariance?: number;
  pitchMeanHz?: number;
  pitchVariance?: number;
  interpretationLimits: string[];
}

export interface LiveConversationTurnContext {
  id: string;
  speaker: 'user' | 'jhadina';
  text: string;
  createdAt: string;
}

export interface LiveWorkSessionContext {
  id: string;
  goal?: string;
  activeSubsystems: string[];
  admittedArtifactIds: string[];
}

export interface LiveContextContribution {
  source: 'ask-jhadina-live';
  observedAt: string;
  recentTurns: LiveConversationTurnContext[];
  workSession?: LiveWorkSessionContext;
  limitations: string[];
}


/** Domain extensions are additive; existing ContextPacket consumers remain valid. */
export interface DomainContext {
  spatial?: SpatialDomainContext;
  social?: SocialDomainContext;
  growth?: GrowthDomainContext;
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
  /** Contextual register selects mechanics only; it never changes semantic truth. */
  register?: ExpressionRegister;
  cadenceStyle?: 'tight' | 'conversational' | 'spacious';
  pauseDensity?: 'low' | 'moderate' | 'high';
  metaphorDensity?: 'none' | 'light' | 'moderate';
  bitDepth?: 0 | 1 | 2 | 3;
  allowPlayfulDisagreement?: boolean;
  symbolicFraming?: 'off' | 'interpretive';
  storytellingDepth?: 'none' | 'brief' | 'extended';
  edginess?: 'none' | 'light' | 'moderate';
  reentryToPlayfulness?: 'off' | 'cautious' | 'allowed';
  operationalSass?: 'off' | 'light' | 'moderate';
  affectionateTeasing?: boolean;
  workloadBoundary?: 'implicit' | 'explicit';
  evidenceDiscipline?: 'standard' | 'heightened' | 'strict';
  speakingRate?: 'slow' | 'normal' | 'fast';
  deliberatePauses?: boolean;
  /** Governed presentation target; never permission to omit required facts. */
  responseLength?: 'brief' | 'balanced' | 'detailed';
  tone?: 'warm' | 'conversational' | 'formal';
  reasoningDepth?: 'simple' | 'standard' | 'technical';
  /** Presentation pacing only. It never grants permission to execute actions. */
  interactionStyle?: 'checkpointed' | 'balanced' | 'continuous';
  creativeStyle?: 'conventional' | 'balanced' | 'experimental';
  explanationStyle?: 'standard' | 'step-by-step' | 'evidence-first';
  decisionPresentation?: 'balanced' | 'options';
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
  artifacts?: EphemeralArtifactContext[];
  conversationSignals?: ConversationSignalContext;
  liveContext?: LiveContextContribution;
  ownerContext?: OwnerContextContribution;
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

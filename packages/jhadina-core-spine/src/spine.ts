import type {
  ActionRequest,
  ActionResult,
  ContextPacket,
  DecisionProposal,
  Experience,
  MemoryProposal,
  PatternObservation,
  PersonalityState,
  PolicyDecision,
} from './types.js';
import type {
  EvolutionPort,
  ImprovementInput,
  ImprovementProposal,
} from './evolution.js';

export interface MemoryPort {
  observe(experience: Experience): Promise<MemoryProposal[]>;
  loadRelevant(experience: Experience): Promise<MemoryProposal[]>;
}

export interface PatternPort {
  detect(experience: Experience, memories: MemoryProposal[]): Promise<PatternObservation[]>;
}

export interface PersonalityPort {
  build(patterns: PatternObservation[], memories: MemoryProposal[]): Promise<PersonalityState>;
}

export interface ContextPort {
  build(input: {
    experience: Experience;
    memories: MemoryProposal[];
    patterns: PatternObservation[];
    personality: PersonalityState;
  }): Promise<ContextPacket>;
}

export interface DecisionPort {
  decide(context: ContextPacket): Promise<DecisionProposal>;
}

/**
 * Decision-governance boundary. This answers whether Jhadina should pursue
 * the proposed course of action; it is not concrete action authorization.
 */
export interface PolicyPort {
  evaluate(proposal: DecisionProposal): Promise<PolicyDecision>;
}

/**
 * Composition boundary implemented by the concrete Action Core layer.
 *
 * Core Spine may construct a semantic action only after decision governance
 * permits PROCEED. Action Core remains the authority for concrete action
 * authorization, approval receipts, execution, and action-level audit.
 */
export interface ActionPort {
  prepare(proposal: DecisionProposal): Promise<ActionRequest | undefined>;
  authorizeAndExecute(request: ActionRequest): Promise<ActionResult>;
}

export interface AuditPort {
  record(event: {
    type: string;
    actor: string;
    subjectId: string;
    payload: Record<string, unknown>;
  }): Promise<void>;
}

export interface SpinePorts {
  memory: MemoryPort;
  pattern: PatternPort;
  personality: PersonalityPort;
  context: ContextPort;
  decision: DecisionPort;
  policy: PolicyPort;
  action: ActionPort;
  audit: AuditPort;
  evolution: EvolutionPort;
}

export interface SpineRunResult {
  memories: MemoryProposal[];
  patterns: PatternObservation[];
  personality: PersonalityState;
  context: ContextPacket;
  decision: DecisionProposal;
  policy: PolicyDecision;
  action?: ActionRequest;
  result?: ActionResult;
}

/**
 * Jhadina's control-plane orchestration boundary.
 *
 * This class contains no LLM implementation and no concrete action
 * authorization. It owns ordering from context through decision governance;
 * Action Core owns authorization, approval, execution, and action-level audit.
 */
export class JhadinaSpine {
  constructor(private readonly ports: SpinePorts) {}

  async run(experience: Experience): Promise<SpineRunResult> {
    const memories = await this.ports.memory.observe(experience);
    const relevantMemories = await this.ports.memory.loadRelevant(experience);
    const combinedMemories = [...memories, ...relevantMemories];

    const patterns = await this.ports.pattern.detect(experience, combinedMemories);
    const personality = await this.ports.personality.build(patterns, combinedMemories);

    const context = await this.ports.context.build({
      experience,
      memories: combinedMemories,
      patterns,
      personality,
    });

    const decision = await this.ports.decision.decide(context);
    const policy = await this.ports.policy.evaluate(decision);

    const governanceEvent =
      policy.disposition === 'DENY'
        ? 'POLICY_DENIED'
        : policy.disposition === 'APPROVAL_REQUIRED'
          ? 'DECISION_APPROVAL_REQUIRED'
          : 'DECISION_PROCEED';

    await this.ports.audit.record({
      type: governanceEvent,
      actor: 'jhadina',
      subjectId: decision.id,
      payload: {
        proposalId: decision.id,
        disposition: policy.disposition,
        reason: policy.reason,
      },
    });

    // Decision governance is not executable-action authorization. A decision
    // that requires approval stops here; Action Core owns concrete approval.
    if (policy.disposition !== 'ALLOW') {
      return { memories, patterns, personality, context, decision, policy };
    }

    const action = await this.ports.action.prepare(decision);
    if (!action) {
      return { memories, patterns, personality, context, decision, policy };
    }

    // Action Core performs concrete authorization and any receipt-backed
    // approval before execution. The spine never pre-authorizes the action.
    const result = await this.ports.action.authorizeAndExecute(action);

    return { memories, patterns, personality, context, decision, policy, action, result };
  }

  async inspectForImprovement(input: ImprovementInput): Promise<ImprovementProposal> {
    return this.ports.evolution.analyze(input);
  }
}

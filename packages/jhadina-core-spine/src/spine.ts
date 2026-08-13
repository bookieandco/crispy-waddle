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

export interface PolicyPort {
  evaluate(proposal: DecisionProposal): Promise<PolicyDecision>;
}

export interface ActionPort {
  prepare(proposal: DecisionProposal, policy: PolicyDecision): Promise<ActionRequest | undefined>;
  execute(request: ActionRequest): Promise<ActionResult>;
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
 * This class deliberately contains no LLM implementation and no domain-specific
 * business logic. Providers implement the ports; the spine owns ordering and
 * the invariant that decisions pass through context and policy before action.
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

    await this.ports.audit.record({
      type: policy.allowed ? 'DECISION_AUTHORIZED' : 'POLICY_DENIED',
      actor: 'jhadina',
      subjectId: decision.id,
      payload: {
        proposalId: decision.id,
        allowed: policy.allowed,
        reason: policy.reason,
      },
    });

    if (!policy.allowed) {
      return { memories, patterns, personality, context, decision, policy };
    }

    const action = await this.ports.action.prepare(decision, policy);
    if (!action) {
      return { memories, patterns, personality, context, decision, policy };
    }

    const result = await this.ports.action.execute(action);

    await this.ports.audit.record({
      type: result.success ? 'ACTION_COMPLETED' : 'ACTION_FAILED',
      actor: 'jhadina',
      subjectId: action.id,
      payload: {
        requestId: action.id,
        success: result.success,
      },
    });

    return { memories, patterns, personality, context, decision, policy, action, result };
  }

  /**
   * Accept an idea, conversation, code sample, repository, or other artifact
   * as evidence and ask the evolution provider to determine whether it should
   * become a Jhadina improvement. Intake creates a proposal only; it does not
   * install, deploy, or grant permissions.
   */
  async inspectForImprovement(input: ImprovementInput): Promise<ImprovementProposal> {
    return this.ports.evolution.analyze(input);
  }
}

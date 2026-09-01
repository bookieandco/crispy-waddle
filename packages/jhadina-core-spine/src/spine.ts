import type {
  ActionResult,
  ContextPacket,
  DecisionProposal,
  Experience,
  MemoryProposal,
  PatternObservation,
  PersonalityState,
} from './types.js';
import type {
  CanonicalActionPort,
  CanonicalActionRequest,
  CanonicalPolicyDecision,
  CanonicalPolicyPort,
} from './canonical-action.js';
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

/** Policy is an injected authority; it authorizes only concrete prepared actions. */
export type PolicyPort = CanonicalPolicyPort;
export type ActionPort = CanonicalActionPort;

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
  policy?: CanonicalPolicyDecision;
  action?: CanonicalActionRequest;
  result?: ActionResult;
}

/**
 * Jhadina's control-plane orchestration boundary.
 *
 * Security invariant: the model-level DecisionProposal is never authorized.
 * An ActionPort must first produce the concrete, application-fixed action;
 * only that action is sent to the injected authoritative PolicyPort.
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
    const action = await this.ports.action.prepare(decision);

    if (!action) {
      await this.ports.audit.record({
        type: 'ACTION_NOT_PREPARED',
        actor: 'jhadina',
        subjectId: decision.id,
        payload: { proposalId: decision.id },
      });
      return { memories, patterns, personality, context, decision };
    }

    const policy = await this.ports.policy.evaluate(action);

    await this.ports.audit.record({
      type:
        policy.decision === 'allow'
          ? 'ACTION_AUTHORIZED'
          : policy.decision === 'approval_required'
            ? 'ACTION_APPROVAL_REQUIRED'
            : 'POLICY_DENIED',
      actor: policy.actorId,
      subjectId: action.id,
      payload: {
        requestId: action.id,
        proposalId: action.proposalId,
        actorId: action.actorId,
        capability: action.capability,
        resourceId: action.resourceId,
        decision: policy.decision,
        policyDecisionId: policy.decisionId,
        policyVersion: policy.policyVersion,
      },
    });

    // approval_required is not authorization to execute. A separate approval
    // flow must convert it into an execution-authorizing decision/receipt.
    if (policy.decision !== 'allow') {
      return { memories, patterns, personality, context, decision, policy, action };
    }

    const result = await this.ports.action.execute(action, policy);

    await this.ports.audit.record({
      type: result.success ? 'ACTION_COMPLETED' : 'ACTION_FAILED',
      actor: policy.actorId,
      subjectId: action.id,
      payload: {
        requestId: action.id,
        policyDecisionId: policy.decisionId,
        policyVersion: policy.policyVersion,
        success: result.success,
      },
    });

    return { memories, patterns, personality, context, decision, policy, action, result };
  }

  async inspectForImprovement(input: ImprovementInput): Promise<ImprovementProposal> {
    return this.ports.evolution.analyze(input);
  }
}

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
import type { EvolutionPort, ImprovementInput, ImprovementProposal } from './evolution.js';
import { assessSituation, type SituationalInput, type SituationalSignals } from './situational-awareness.js';
import { createPersonalitySliderProfile, expressPersonality, type PersonalityExpression } from './personality-expression.js';

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

export interface SituationalAwarenessPort {
  assess(experience: Experience, personality: PersonalityState): Promise<SituationalInput>;
}

export interface ContextPort {
  build(input: {
    experience: Experience;
    memories: MemoryProposal[];
    patterns: PatternObservation[];
    personality: PersonalityState;
    situationalAwareness?: SituationalSignals;
    personalityExpression?: PersonalityExpression;
  }): Promise<ContextPacket>;
}

export interface DecisionPort { decide(context: ContextPacket): Promise<DecisionProposal>; }
export interface PolicyPort { evaluate(proposal: DecisionProposal): Promise<PolicyDecision>; }
export interface ActionPort {
  prepare(proposal: DecisionProposal, policy: PolicyDecision): Promise<ActionRequest | undefined>;
  execute(request: ActionRequest): Promise<ActionResult>;
}
export interface AuditPort {
  record(event: { type: string; actor: string; subjectId: string; payload: Record<string, unknown> }): Promise<void>;
}

export interface SpinePorts {
  memory: MemoryPort;
  pattern: PatternPort;
  personality: PersonalityPort;
  situationalAwareness?: SituationalAwarenessPort;
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
  situationalAwareness: SituationalSignals;
  personalityExpression: PersonalityExpression;
  decision: DecisionProposal;
  policy: PolicyDecision;
  action?: ActionRequest;
  result?: ActionResult;
}

export class JhadinaSpine {
  constructor(private readonly ports: SpinePorts) {}

  async run(experience: Experience): Promise<SpineRunResult> {
    const memories = await this.ports.memory.observe(experience);
    const relevantMemories = await this.ports.memory.loadRelevant(experience);
    const combinedMemories = [...memories, ...relevantMemories];
    const patterns = await this.ports.pattern.detect(experience, combinedMemories);
    const personality = await this.ports.personality.build(patterns, combinedMemories);

    const situationalInput = this.ports.situationalAwareness
      ? await this.ports.situationalAwareness.assess(experience, personality)
      : {};
    const situationalAwareness = assessSituation(situationalInput);
    const personalityProfile = createPersonalitySliderProfile();
    const personalityExpression = expressPersonality(personalityProfile, situationalAwareness);

    const context = await this.ports.context.build({
      experience,
      memories: combinedMemories,
      patterns,
      personality,
      situationalAwareness,
      personalityExpression,
    });

    const decision = await this.ports.decision.decide(context);
    const policy = await this.ports.policy.evaluate(decision);

    await this.ports.audit.record({
      type: policy.allowed ? 'DECISION_AUTHORIZED' : 'POLICY_DENIED',
      actor: 'jhadina', subjectId: decision.id,
      payload: { proposalId: decision.id, allowed: policy.allowed, reason: policy.reason },
    });

    if (!policy.allowed) return { memories, patterns, personality, context, situationalAwareness, personalityExpression, decision, policy };
    const action = await this.ports.action.prepare(decision, policy);
    if (!action) return { memories, patterns, personality, context, situationalAwareness, personalityExpression, decision, policy };
    const result = await this.ports.action.execute(action);

    await this.ports.audit.record({
      type: result.success ? 'ACTION_COMPLETED' : 'ACTION_FAILED',
      actor: 'jhadina', subjectId: action.id,
      payload: { requestId: action.id, success: result.success },
    });
    return { memories, patterns, personality, context, situationalAwareness, personalityExpression, decision, policy, action, result };
  }

  async inspectForImprovement(input: ImprovementInput): Promise<ImprovementProposal> {
    return this.ports.evolution.analyze(input);
  }
}

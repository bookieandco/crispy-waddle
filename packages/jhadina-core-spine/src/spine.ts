import type { ActionRequest, ActionResult, ContextPacket, DecisionProposal, Experience, MemoryProposal, PatternObservation, PersonalityState, PolicyDecision } from './types.js';
import type { EvolutionPort, ImprovementInput, ImprovementProposal } from './evolution.js';
import type { RealCore, RealCoreStore } from '@jhadina/real-core';
import type { QuipGenerator, ResearchCapability, KnowledgeCheck, ResearchCapabilityResult } from '@jhadina/entertainment-core';
import { RealCoreRuntime } from './real-core-runtime.js';
import { QuipRuntime, type QuipRuntimeResult } from './quip-runtime.js';

export interface MemoryPort { observe(experience: Experience): Promise<MemoryProposal[]>; loadRelevant(experience: Experience): Promise<MemoryProposal[]>; }
export interface PatternPort { detect(experience: Experience, memories: MemoryProposal[]): Promise<PatternObservation[]>; }
export interface PersonalityPort { build(patterns: PatternObservation[], memories: MemoryProposal[]): Promise<PersonalityState>; }
export interface ContextPort { build(input: { experience: Experience; memories: MemoryProposal[]; patterns: PatternObservation[]; personality: PersonalityState }): Promise<ContextPacket>; }
export interface DecisionPort { decide(context: ContextPacket): Promise<DecisionProposal>; }
export interface PolicyPort { evaluate(proposal: DecisionProposal): Promise<PolicyDecision>; }
export interface ActionPort { prepare(proposal: DecisionProposal, policy: PolicyDecision): Promise<ActionRequest | undefined>; execute(request: ActionRequest): Promise<ActionResult>; }
export interface AuditPort { record(event: { type: string; actor: string; subjectId: string; payload: Record<string, unknown> }): Promise<void>; }
export interface SpinePorts { memory: MemoryPort; pattern: PatternPort; personality: PersonalityPort; context: ContextPort; decision: DecisionPort; policy: PolicyPort; action: ActionPort; audit: AuditPort; evolution: EvolutionPort; }
export interface SpineRunResult { memories: MemoryProposal[]; patterns: PatternObservation[]; personality: PersonalityState; context: ContextPacket; decision: DecisionProposal; policy: PolicyDecision; action?: ActionRequest; result?: ActionResult; realCore?: ReturnType<RealCore['snapshot']>; quip?: QuipRuntimeResult; research?: ResearchCapabilityResult; response?: string; }
export interface JhadinaSpineOptions { realCore?: RealCore; realCoreStore?: RealCoreStore; quipGenerator?: QuipGenerator; quipConfidenceFloor?: number; researchCapability?: ResearchCapability; knowledgeCheck?: (input: Experience, context: ContextPacket) => Promise<KnowledgeCheck>; }

export class JhadinaSpine {
  private readonly realRuntime?: RealCoreRuntime;
  private readonly quipRuntime?: QuipRuntime;
  private readonly researchCapability?: ResearchCapability;
  private readonly knowledgeCheck?: (input: Experience, context: ContextPacket) => Promise<KnowledgeCheck>;

  constructor(private readonly ports: SpinePorts, options: JhadinaSpineOptions = {}) {
    this.realRuntime = options.realCore ? new RealCoreRuntime(options.realCore, options.realCoreStore) : undefined;
    this.quipRuntime = options.quipGenerator ? new QuipRuntime(options.quipGenerator, options.quipConfidenceFloor) : undefined;
    this.researchCapability = options.researchCapability;
    this.knowledgeCheck = options.knowledgeCheck;
  }

  async run(experience: Experience): Promise<SpineRunResult> {
    await this.realRuntime?.hydrate();
    const realObservation = await this.realRuntime?.observe(experience);
    const humor = realObservation?.humor;
    const voice = realObservation?.voice;
    const memories = await this.ports.memory.observe(experience);
    const relevantMemories = await this.ports.memory.loadRelevant(experience);
    const combinedMemories = [...memories, ...relevantMemories];
    const patterns = await this.ports.pattern.detect(experience, combinedMemories);
    const personality = await this.ports.personality.build(patterns, combinedMemories);
    const baseContext = await this.ports.context.build({ experience, memories: combinedMemories, patterns, personality });
    let context = realObservation ? this.realRuntime!.augmentContext(baseContext, realObservation.contextState, realObservation.real.stance, humor, voice) : baseContext;

    let research: ResearchCapabilityResult | undefined;
    if (this.researchCapability && this.knowledgeCheck) {
      const check = await this.knowledgeCheck(experience, context);
      research = await this.researchCapability.execute(experience.content, check);
      await this.ports.audit.record({
        type: research.denied ? 'RESEARCH_DENIED' : research.researched ? 'RESEARCH_AUTHORIZED' : 'RESEARCH_NOT_NEEDED',
        actor: 'jhadina',
        subjectId: research.intent ? `research:${research.intent.requestedAt}` : experience.id,
        payload: {
          query: experience.content,
          knowledgeState: check.state,
          confidence: check.confidence,
          reason: check.reason,
          researched: research.researched,
          denied: research.denied,
          result: research.result ? {
            discovered: research.result.discovered,
            crawled: research.result.crawled,
            verified: research.result.verified,
            corroborated: research.result.corroborated,
            promoted: research.result.promoted,
            duplicates: research.result.duplicates,
            rejected: research.result.rejected,
          } : undefined,
        },
      });
      if (research.result) {
        context = {
          ...context,
          knowledge: [...context.knowledge, ...research.result.signals.filter((item) => item.promoted).map((item) => ({ id: item.evidence.id, source: item.evidence.source, observedAt: item.evidence.lastSeenAt, summary: item.signal.summary }))],
          constraints: [...context.constraints, `Research completed: ${research.result.verified} verified, ${research.result.corroborated} corroborated, ${research.result.rejected} rejected.`],
        };
      } else if (research.denied) {
        context = { ...context, constraints: [...context.constraints, `Research denied by policy ${research.denied.policyId}: ${research.denied.reason}`] };
      }
    }

    const quip = this.quipRuntime ? await this.quipRuntime.tryFastPath({ text: experience.content, humor, voice }) : undefined;
    const decision = quip?.used && quip.candidate
      ? { id: `quip:${experience.id}`, contextId: context.id, disposition: 'PROCEED' as const, recommendation: quip.candidate.text, rationale: `Fast conversational quip accepted with confidence ${quip.confidence.toFixed(2)}.`, evidence: [], uncertainty: [], alternatives: [] }
      : await this.ports.decision.decide(context);

    const policy = await this.ports.policy.evaluate(decision);
    await this.ports.audit.record({ type: policy.allowed ? 'DECISION_AUTHORIZED' : 'POLICY_DENIED', actor: 'jhadina', subjectId: decision.id, payload: { proposalId: decision.id, allowed: policy.allowed, reason: policy.reason, research: research ? { researched: research.researched, denied: research.denied } : undefined, realCoreStance: realObservation?.real.stance, realCoreStateVersion: realObservation?.contextState.version, fastQuip: quip?.used ?? false, quipConfidence: quip?.confidence ?? 0, fallback: quip?.fallback ?? false, humor: humor ? { shouldHumor: humor.shouldHumor, intensity: humor.intensity, score: humor.score, rankedModes: humor.rankedModes } : undefined, voice: voice ? { register: voice.register, quipiness: voice.quipiness, profanityAllowed: voice.profanityAllowed, profanityIntensity: voice.profanityIntensity } : undefined } });
    if (!policy.allowed) return { memories, patterns, personality, context, decision, policy, realCore: realObservation?.contextState, quip, research };

    if (quip?.used && quip.candidate) return { memories, patterns, personality, context, decision, policy, realCore: realObservation?.contextState, quip, research, response: quip.candidate.text };

    const action = await this.ports.action.prepare(decision, policy);
    if (!action) return { memories, patterns, personality, context, decision, policy, realCore: realObservation?.contextState, quip, research };
    const result = await this.ports.action.execute(action);
    await this.ports.audit.record({ type: result.success ? 'ACTION_COMPLETED' : 'ACTION_FAILED', actor: 'jhadina', subjectId: action.id, payload: { requestId: action.id, success: result.success } });
    await this.realRuntime?.observe({ id: `outcome:${result.id}`, occurredAt: result.completedAt, source: 'jhadina-action-outcome', content: result.success ? `Action ${action.operation} completed successfully.` : `Action ${action.operation} failed: ${result.error ?? 'unknown error'}`, evidence: [{ id: result.id, source: 'action-result', observedAt: result.completedAt, summary: result.success ? 'Action completed successfully' : (result.error ?? 'Action failed') }] });
    return { memories, patterns, personality, context, decision, policy, action, result, realCore: this.realRuntime?.snapshot(), quip, research };
  }

  async inspectForImprovement(input: ImprovementInput): Promise<ImprovementProposal> { return this.ports.evolution.analyze(input); }
}

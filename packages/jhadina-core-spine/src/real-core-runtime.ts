import type { RealCore, RealCoreResult, RealCoreStore, RealExperience, RealState } from '@jhadina/real-core';
import { HumorCore, type HumorAudience, type HumorOpportunity } from '@jhadina/entertainment-core';
import type { Experience, ContextPacket, HumorContextState } from './types.js';

export interface RealCoreRuntimeResult {
  real: RealCoreResult;
  contextState: RealState;
  humor?: HumorContextState;
}

/** Bridges continuity state into the control-plane and optionally persists it. */
export class RealCoreRuntime {
  constructor(
    private readonly core: RealCore,
    private readonly store?: RealCoreStore,
    private readonly humor = new HumorCore(),
  ) {}

  snapshot(): RealState { return this.core.snapshot(); }

  async hydrate(): Promise<RealState> {
    if (!this.store) return this.snapshot();
    const persisted = await this.store.load(this.snapshot().identity.continuityKey);
    if (persisted) this.core.restore(persisted);
    return this.snapshot();
  }

  async observe(experience: Experience): Promise<RealCoreRuntimeResult> {
    const realExperience: RealExperience = {
      id: experience.id, occurredAt: experience.occurredAt, source: experience.source,
      content: experience.content, significance: 'medium',
      evidence: experience.evidence.map((item) => ({ id: item.id, source: item.source, observedAt: item.observedAt, summary: item.summary })),
      context: experience.domain ? [experience.domain] : [],
    };
    const real = this.core.observe(realExperience);
    if (this.store) await this.store.save(real.state);
    return { real, contextState: real.state };
  }

  async save(): Promise<void> { if (this.store) await this.store.save(this.snapshot()); }

  evaluateHumor(experience: Experience): HumorContextState {
    const audience = this.resolveAudience(experience);
    const opportunity: HumorOpportunity = {
      context: experience.content,
      audience,
      seriousness: this.estimateSeriousness(experience),
      emotionalLoad: this.estimateEmotionalLoad(experience),
      risk: this.estimateRisk(experience),
      callbackCandidates: this.snapshot().recentExperiences.slice(-5),
    };
    const decision = this.humor.evaluate(opportunity, experience.actor === 'user' ? this.snapshot().identity.continuityKey : undefined);
    return {
      shouldHumor: decision.shouldHumor,
      intensity: decision.intensity,
      score: decision.score,
      reason: decision.reason,
      rankedModes: this.humor.rankModes(opportunity),
    };
  }

  augmentContext(context: ContextPacket, state: RealState, stance?: RealCoreResult['stance'], humor?: HumorContextState): ContextPacket {
    const realEvidence = state.recentExperiences.map((id) => ({ id: `real-experience:${id}`, source: 'real-core', observedAt: state.updatedAt, summary: `Recent Jhadina experience: ${id}` }));
    const realTraits = [
      ...state.preferences.filter((p) => p.status === 'accepted').map((p) => ({ id: `real-preference:${p.id}`, statement: p.statement, category: 'preference' as const, confidence: p.confidence, stability: p.stability, evidence: p.evidence.map((e) => ({ ...e, immutable: false })), contradictions: [], status: 'accepted' as const })),
      ...state.opinions.filter((o) => o.status === 'active').map((o) => ({ id: `real-opinion:${o.id}`, statement: o.statement, category: 'decision' as const, confidence: o.confidence, stability: 0.7, evidence: o.evidence.map((e) => ({ ...e, immutable: false })), contradictions: [], status: 'accepted' as const })),
    ];
    const continuity = [
      `Real Core attention: ${state.attention.subject} (${state.attention.priority}) — ${state.attention.reason}`,
      ...state.activeGoals.map((goal) => `Real Core active goal: ${goal}`),
      ...state.openLoops.filter((l) => l.status !== 'closed').slice(-12).map((l) => `Real Core open loop [${l.priority}]: ${l.description}`),
      ...state.commitments.filter((c) => c.status === 'open').slice(-12).map((c) => `Real Core commitment [${c.priority}]: ${c.statement}`),
      ...(stance ? [`Real Core current stance: ${stance}`] : []),
      ...(humor ? [`Real Core humor: ${humor.shouldHumor ? 'available' : 'suppressed'} (${humor.intensity.toFixed(2)}); preferred modes: ${humor.rankedModes.join(', ')}`] : []),
    ];
    return {
      ...context,
      personality: { ...context.personality, traits: [...context.personality.traits, ...realTraits] },
      relevantMemories: [...context.relevantMemories, ...realEvidence],
      constraints: [...context.constraints, ...continuity, ...state.uncertainty.map((item) => `Real Core uncertainty: ${item}`)],
      ...(humor ? { humor } : {}),
    };
  }

  private resolveAudience(experience: Experience): HumorAudience {
    if (experience.domain === 'social' || experience.source.includes('social')) return 'public';
    if (experience.domain === 'professional' || experience.source.includes('work')) return 'professional';
    if (experience.actor === 'user') return 'private';
    return 'public';
  }

  private estimateSeriousness(experience: Experience): number {
    return /emergency|urgent|security|fraud|legal|medical|critical|death|danger/i.test(experience.content) ? 0.95 : 0.25;
  }

  private estimateEmotionalLoad(experience: Experience): number {
    return /angry|upset|sad|hurt|afraid|stress|panic|grief|conflict/i.test(experience.content) ? 0.8 : 0.2;
  }

  private estimateRisk(experience: Experience): 'low' | 'medium' | 'high' {
    if (/emergency|security|fraud|legal|medical|critical|danger/i.test(experience.content)) return 'high';
    if (/money|payment|contract|public|reputation/i.test(experience.content)) return 'medium';
    return 'low';
  }
}

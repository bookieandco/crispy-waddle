import type { RealCore, RealCoreResult, RealExperience, RealState } from '@jhadina/real-core';
import type { Experience, ContextPacket } from './types.js';

export interface RealCoreRuntimeResult {
  real: RealCoreResult;
  contextState: RealState;
}

/** Bridges the stateful behavioral core into the control-plane experience model. */
export class RealCoreRuntime {
  constructor(private readonly core: RealCore) {}

  snapshot(): RealState {
    return this.core.snapshot();
  }

  observe(experience: Experience): RealCoreRuntimeResult {
    const realExperience: RealExperience = {
      id: experience.id,
      occurredAt: experience.occurredAt,
      source: experience.source,
      content: experience.content,
      significance: 'medium',
      evidence: experience.evidence.map((item) => ({
        id: item.id,
        source: item.source,
        observedAt: item.observedAt,
        summary: item.summary,
      })),
      context: experience.domain ? [experience.domain] : [],
    };

    const real = this.core.observe(realExperience);
    return { real, contextState: real.state };
  }

  augmentContext(context: ContextPacket, state: RealState): ContextPacket {
    const realEvidence = state.recentExperiences.map((id) => ({
      id: `real-experience:${id}`,
      source: 'real-core',
      observedAt: state.updatedAt,
      summary: `Recent Jhadina experience: ${id}`,
    }));

    return {
      ...context,
      personality: {
        ...context.personality,
        traits: [
          ...context.personality.traits,
          ...state.preferences.filter((p) => p.status === 'accepted').map((p) => ({
            id: `real-preference:${p.id}`,
            statement: p.statement,
            category: 'preference' as const,
            confidence: p.confidence,
            stability: p.stability,
            evidence: p.evidence.map((e) => ({ ...e, immutable: false })),
            contradictions: [],
            status: 'accepted' as const,
          })),
        ],
      },
      relevantMemories: [...context.relevantMemories, ...realEvidence],
      constraints: [
        ...context.constraints,
        ...state.uncertainty.map((item) => `Real Core uncertainty: ${item}`),
      ],
    };
  }
}

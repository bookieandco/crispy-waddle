import type { GrowthId } from '../domain/types.js';
import type { GrowthLearning } from '../learning/growth-learning.js';

export interface CreativeBrief {
  id: GrowthId;
  objective: string;
  audience?: string;
  offer?: string;
  hook?: string;
  format?: string;
  channel?: string;
  hypothesis: string;
  rationale: string;
  supportingLearningIds: GrowthId[];
  evidenceEventIds: GrowthId[];
  status: 'draft' | 'approved';
}

export function createCreativeBrief(
  learning: readonly GrowthLearning[],
  objective: string,
): CreativeBrief {
  const validated = learning.filter((item) => item.status === 'validated');
  const strongest = [...validated].sort((a, b) => b.confidence - a.confidence)[0];
  const signals = strongest?.reusableSignals ?? {};

  return {
    id: `brief:${Date.now()}`,
    objective,
    audience: signals.audience,
    offer: signals.offer,
    hook: signals.hook,
    format: signals.format,
    channel: signals.channel,
    hypothesis: strongest?.hypothesis ?? 'No validated learning is available yet.',
    rationale: strongest
      ? `${strongest.finding} Confidence=${strongest.confidence.toFixed(2)}; evidence=${strongest.evidenceScore.toFixed(2)}.`
      : 'Generate exploratory creative only; no validated learning supports this brief yet.',
    supportingLearningIds: strongest ? [strongest.id] : [],
    evidenceEventIds: strongest ? strongest.evidenceEventIds : [],
    status: 'draft',
  };
}

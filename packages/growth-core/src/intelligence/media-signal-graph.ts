import type { GrowthId } from '../domain/types.js';
import type { MediaSignal } from './media-signal.js';

export type MediaGraphNodeType = 'entity' | 'topic' | 'content' | 'audience';

export interface MediaGraphNode {
  readonly id: GrowthId;
  readonly type: MediaGraphNodeType;
}

export interface MediaGraphEdge {
  readonly from: GrowthId;
  readonly to: GrowthId;
  readonly relation: 'mentions' | 'covers' | 'contains' | 'signals';
  readonly weight: number;
  readonly confidence: number;
  readonly evidence: readonly string[];
  readonly observedAt: string;
}

export interface MediaGraphDelta {
  readonly nodes: readonly MediaGraphNode[];
  readonly edges: readonly MediaGraphEdge[];
}

const clamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

export function mediaSignalToGraphDelta(signal: MediaSignal): MediaGraphDelta {
  const nodes = [
    ...signal.entityRefs.map((id) => ({ id, type: 'entity' as const })),
    ...signal.topicRefs.map((id) => ({ id, type: 'topic' as const })),
    ...signal.contentRefs.map((id) => ({ id, type: 'content' as const })),
  ];
  const edges: MediaGraphEdge[] = [
    ...signal.entityRefs.map((id) => ({ from: signal.id, to: id, relation: 'mentions' as const, weight: 1, confidence: clamp(signal.confidence), evidence: signal.provenance, observedAt: signal.observedAt })),
    ...signal.topicRefs.map((id) => ({ from: signal.id, to: id, relation: 'covers' as const, weight: 1, confidence: clamp(signal.confidence), evidence: signal.provenance, observedAt: signal.observedAt })),
    ...signal.contentRefs.map((id) => ({ from: signal.id, to: id, relation: 'contains' as const, weight: 1, confidence: clamp(signal.confidence), evidence: signal.provenance, observedAt: signal.observedAt })),
  ];
  return { nodes, edges };
}

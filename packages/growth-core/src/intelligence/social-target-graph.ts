import type { GrowthId } from '../domain/types.js';

export type SocialTargetSignal = 'buyer_intent' | 'audience_fit' | 'engagement' | 'community' | 'topic' | 'creator' | 'conversion';

export interface SocialTargetNode {
  readonly id: GrowthId;
  readonly platform: string;
  readonly externalRef: string;
  readonly kind: 'person' | 'account' | 'community' | 'topic' | 'post';
}

export interface SocialTargetEdge {
  readonly from: GrowthId;
  readonly to: GrowthId;
  readonly signal: SocialTargetSignal;
  readonly weight: number;
  readonly observedAt: string;
  readonly evidence: readonly GrowthId[];
}

export interface SocialTargetGraph {
  readonly nodes: readonly SocialTargetNode[];
  readonly edges: readonly SocialTargetEdge[];
}

export interface TargetCandidate {
  readonly nodeId: GrowthId;
  readonly score: number;
  readonly reasons: readonly SocialTargetSignal[];
  readonly evidence: readonly GrowthId[];
}

const clamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

export function rankTargetCandidates(graph: SocialTargetGraph, targetIds: readonly GrowthId[] = graph.nodes.map((node) => node.id)): TargetCandidate[] {
  return targetIds.map((nodeId) => {
    const edges = graph.edges.filter((edge) => edge.to === nodeId);
    const bySignal = new Map<SocialTargetSignal, number>();
    for (const edge of edges) bySignal.set(edge.signal, Math.max(bySignal.get(edge.signal) ?? 0, clamp(edge.weight)));
    const buyer = bySignal.get('buyer_intent') ?? 0;
    const fit = bySignal.get('audience_fit') ?? 0;
    const conversion = bySignal.get('conversion') ?? 0;
    const engagement = bySignal.get('engagement') ?? 0;
    const community = bySignal.get('community') ?? 0;
    const score = clamp(buyer * 0.4 + fit * 0.2 + conversion * 0.2 + engagement * 0.1 + community * 0.1);
    return { nodeId, score, reasons: [...bySignal.entries()].filter(([, weight]) => weight >= 0.5).map(([signal]) => signal), evidence: edges.flatMap((edge) => edge.evidence) };
  }).sort((a, b) => b.score - a.score);
}

import type { GrowthId } from '../domain/types.js';
import type { EvidenceItem } from './evidence-contract.js';

export interface DistilledEvidence {
  evidenceId: GrowthId;
  summary: string;
  claims: readonly string[];
  metrics: Readonly<Record<string, number>>;
  confidence: number;
  sourceRefs: readonly GrowthId[];
}

function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Cheap, deterministic first-pass distillation. It does not pretend to understand
 * truth; it extracts bounded textual/metric evidence for later AI or human review.
 */
export function distillEvidence(item: EvidenceItem): DistilledEvidence {
  const text = normalize(item.text ?? item.title);
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean).slice(0, 5);
  const claims = sentences.slice(0, 3);
  const hasMetrics = Object.keys(item.metrics ?? {}).length > 0;
  const confidence = hasMetrics && item.uri ? 80 : item.text ? 65 : 40;

  return {
    evidenceId: item.id,
    summary: normalize(sentences.slice(0, 2).join(' ')).slice(0, 500),
    claims,
    metrics: { ...(item.metrics ?? {}) },
    confidence,
    sourceRefs: [item.id],
  };
}

export function distillEvidenceBatch(items: readonly EvidenceItem[]): DistilledEvidence[] {
  return items.map(distillEvidence);
}

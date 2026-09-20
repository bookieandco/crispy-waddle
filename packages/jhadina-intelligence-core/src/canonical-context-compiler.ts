import { createHash } from 'node:crypto';
import type { ContextPacket, EvidenceRef } from '@jhadina/core-spine';
import type { CompiledIntelligenceContext, IntelligenceContextCompiler, IntelligenceTask } from './intelligence-fabric.js';
import type { RetrievalCandidate } from './hybrid-retrieval.js';

export interface CanonicalContextAugmentation {
  readonly candidates: readonly RetrievalCandidate[];
  readonly deniedEvidenceIds?: readonly string[];
}

export interface CanonicalContextCompilerOptions {
  readonly augmentation?: (task: IntelligenceTask, packet: ContextPacket) => Promise<CanonicalContextAugmentation>;
  readonly maxAugmentedChars?: number;
}

/**
 * Extends the canonical Core Spine ContextPacket; it does not replace the
 * application Context Builder. The caller must pass the packet produced by
 * that builder. Authorized retrieval may add evidence, but never mutate the
 * source packet, personality, constraints, policy, or durable memory.
 */
export class CanonicalIntelligenceContextCompiler implements IntelligenceContextCompiler {
  constructor(private readonly options: CanonicalContextCompilerOptions = {}) {}

  async compile(task: IntelligenceTask, packet: ContextPacket): Promise<CompiledIntelligenceContext> {
    const augmentation = this.options.augmentation
      ? await this.options.augmentation(task, packet)
      : { candidates: [] };

    const budget = this.options.maxAugmentedChars ?? 4000;
    const selected = selectWithinBudget(augmentation.candidates, budget);
    const augmentedPacket = clonePacket(packet);

    for (const candidate of selected) {
      const ref = candidateToEvidence(candidate);
      if (candidate.sourceKind === 'memory') augmentedPacket.relevantMemories.push(ref);
      else augmentedPacket.knowledge.push(ref);
    }

    const evidenceIds = collectEvidenceIds(augmentedPacket);
    const contextHash = hashStable({
      task: {
        id: task.id, purpose: task.purpose, modalities: task.modalities,
        requiredCapabilities: task.requiredCapabilities, riskClass: task.riskClass,
        privacyClass: task.privacyClass,
      },
      packet: augmentedPacket,
      evidenceIds,
    });

    return Object.freeze({
      task,
      packet: deepFreeze(augmentedPacket),
      evidenceIds: Object.freeze(evidenceIds),
      contextHash,
    });
  }
}

function selectWithinBudget(candidates: readonly RetrievalCandidate[], maxChars: number): RetrievalCandidate[] {
  if (!Number.isInteger(maxChars) || maxChars < 0) throw new Error('CONTEXT_AUGMENTATION_BUDGET_INVALID');
  let used = 0;
  const selected: RetrievalCandidate[] = [];
  for (const candidate of candidates) {
    if (used + candidate.summary.length > maxChars) continue;
    selected.push(candidate); used += candidate.summary.length;
  }
  return selected;
}

function candidateToEvidence(candidate: RetrievalCandidate): EvidenceRef {
  return {
    id: candidate.evidenceId,
    source: `${candidate.sourceKind}:${candidate.sourceId}`,
    observedAt: candidate.observedAt,
    summary: candidate.summary,
    immutable: true,
  };
}

function collectEvidenceIds(packet: ContextPacket): string[] {
  const ids = new Set<string>();
  const add = (refs: readonly EvidenceRef[]) => refs.forEach((ref) => ids.add(ref.id));
  add(packet.relevantMemories); add(packet.knowledge);
  for (const pattern of packet.patterns) { add(pattern.evidence); add(pattern.contradictions); }
  for (const trait of packet.personality.traits) { add(trait.evidence); add(trait.contradictions); }
  const spatial = packet.domainContext?.spatial;
  if (spatial) {
    add(spatial.observations); add(spatial.evidence); add(spatial.claims); add(spatial.reality);
    add(spatial.attention); add(spatial.provenance);
  }
  return [...ids].sort();
}

function clonePacket(packet: ContextPacket): ContextPacket {
  return structuredClone(packet);
}

function hashStable(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

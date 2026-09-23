import type { ContextPacket, DecisionProposal, EvidenceRef } from '@jhadina/core-spine';

function clone(ref: EvidenceRef): EvidenceRef {
  return { ...ref };
}

function pushAll(target: EvidenceRef[], refs: readonly EvidenceRef[] | undefined): void {
  if (!refs) return;
  for (const ref of refs) target.push(ref);
}

/**
 * Collects only evidence that already exists inside the governed ContextPacket.
 * Model/provider output never becomes evidence merely because it named itself as evidence.
 */
export function collectContextEvidence(context: ContextPacket): EvidenceRef[] {
  const refs: EvidenceRef[] = [];
  pushAll(refs, context.relevantMemories);
  pushAll(refs, context.knowledge);

  for (const pattern of context.patterns) {
    pushAll(refs, pattern.evidence);
    pushAll(refs, pattern.contradictions);
  }

  for (const trait of context.personality.traits) {
    pushAll(refs, trait.evidence);
    pushAll(refs, trait.contradictions);
  }
  pushAll(refs, context.personality.taste?.evidence);
  pushAll(refs, context.personality.relationship?.evidence);

  const spatial = context.domainContext?.spatial;
  if (spatial) {
    pushAll(refs, spatial.observations);
    pushAll(refs, spatial.evidence);
    pushAll(refs, spatial.claims);
    pushAll(refs, spatial.reality);
    pushAll(refs, spatial.attention);
    pushAll(refs, spatial.provenance);
  }

  const social = context.domainContext?.social;
  if (social) {
    pushAll(refs, social.accounts);
    pushAll(refs, social.characters);
    pushAll(refs, social.pendingWork);
    pushAll(refs, social.performance);
    pushAll(refs, social.attention);
    pushAll(refs, social.provenance);
  }

  const growth = context.domainContext?.growth;
  if (growth) {
    pushAll(refs, growth.campaigns);
    pushAll(refs, growth.audiences);
    pushAll(refs, growth.pendingWork);
    pushAll(refs, growth.performance);
    pushAll(refs, growth.attention);
    pushAll(refs, growth.provenance);
  }

  for (const item of context.expressionDirective?.callbackProvenance ?? []) {
    refs.push(item.evidence);
  }
  pushAll(refs, context.expressionDirective?.culturalReferenceEvidence);
  pushAll(refs, context.workSession?.evidence);

  for (const artifact of context.artifacts ?? []) {
    refs.push({
      id: artifact.id,
      source: `artifact:${artifact.source}`,
      observedAt: artifact.observedAt,
      summary: `${artifact.kind} artifact ${artifact.name ?? artifact.id} (${artifact.mimeType})`,
      immutable: artifact.source === 'durable-artifact',
    });
  }

  const byId = new Map<string, EvidenceRef>();
  for (const ref of refs) {
    if (!byId.has(ref.id)) byId.set(ref.id, clone(ref));
  }
  return [...byId.values()];
}

/**
 * Rebinds provider-returned evidence IDs to canonical ContextPacket evidence.
 *
 * - unknown IDs are removed
 * - known IDs are replaced with the canonical source/summary/timestamp
 * - duplicates are collapsed
 * - rejected evidence is surfaced as uncertainty rather than silently trusted
 *
 * This is a provenance boundary, not an authority boundary. It does not alter
 * disposition, recommendation, rationale, policy, approvals, or execution.
 */
export function bindProposalEvidenceToContext(
  proposal: DecisionProposal,
  context: ContextPacket,
): DecisionProposal {
  const allowed = new Map(collectContextEvidence(context).map((ref) => [ref.id, ref] as const));
  const bound: EvidenceRef[] = [];
  const seen = new Set<string>();
  let rejected = 0;

  for (const candidate of proposal.evidence) {
    const canonical = allowed.get(candidate.id);
    if (!canonical) {
      rejected += 1;
      continue;
    }
    if (seen.has(canonical.id)) continue;
    seen.add(canonical.id);
    bound.push(clone(canonical));
  }

  const uncertainty = [...proposal.uncertainty];
  if (rejected > 0) {
    uncertainty.push(
      `${rejected} provider evidence reference(s) were excluded because they were not present in the governed ContextPacket.`,
    );
  }

  return {
    ...proposal,
    evidence: bound,
    uncertainty,
  };
}

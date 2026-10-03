import type { HippocampalEpisode } from './hippocampus.js';
import type {
  EvidenceRef,
  MemoryProposal,
  PersonalityRelationshipState,
  PersonalityState,
  RecurringCallbackEvidence,
} from './types.js';

export interface CallbackLearningInput {
  callback: string;
  episodes?: readonly HippocampalEpisode[];
  memories?: readonly MemoryProposal[];
  relationshipEvidence?: readonly EvidenceRef[];
  excludedEvidenceIds?: ReadonlySet<string>;
  minimumIndependentEvidence?: number;
}

export interface CallbackCandidate {
  callback: string;
  evidence: readonly EvidenceRef[];
  independentEvidenceCount: number;
  eligible: boolean;
  reasons: readonly string[];
}

function tokens(value: string): string[] {
  return value.toLowerCase().match(/[a-z0-9][a-z0-9'-]*/g) ?? [];
}

function normalized(value: string): string {
  return tokens(value).join(' ');
}

function supports(value: string, callback: string): boolean {
  const expected = [...new Set(tokens(callback))];
  if (expected.length === 0) return false;
  const actual = new Set(tokens(value));
  return expected.every((token) => actual.has(token));
}

function valid(ref: EvidenceRef): boolean {
  return Boolean(
    ref.id.trim() &&
    ref.source.trim() &&
    ref.summary.trim() &&
    ref.immutable === true &&
    Number.isFinite(Date.parse(ref.observedAt)),
  );
}

function directEpisodeEvidence(episode: HippocampalEpisode): EvidenceRef {
  return {
    id: episode.episodeId,
    source: episode.source,
    observedAt: episode.occurredAt,
    summary: episode.content,
    immutable: true,
  };
}

function collect(input: CallbackLearningInput): EvidenceRef[] {
  const excluded = input.excludedEvidenceIds ?? new Set<string>();
  const refs: EvidenceRef[] = [];

  for (const ref of input.relationshipEvidence ?? []) {
    if (valid(ref) && !excluded.has(ref.id) && supports(ref.summary, input.callback)) refs.push({ ...ref });
  }

  for (const memory of input.memories ?? []) {
    if (memory.disposition !== 'SAVE' || !supports(memory.content, input.callback)) continue;
    for (const ref of memory.evidence) {
      if (valid(ref) && !excluded.has(ref.id) && supports(ref.summary, input.callback)) refs.push({ ...ref });
    }
  }

  for (const episode of input.episodes ?? []) {
    if (!supports(episode.content, input.callback)) continue;
    const matching = episode.evidence.filter((ref) =>
      valid(ref) && !excluded.has(ref.id) && supports(ref.summary, input.callback)
    );
    if (matching.length) refs.push(...matching.map((ref) => ({ ...ref })));
    else {
      const ref = directEpisodeEvidence(episode);
      if (!excluded.has(ref.id)) refs.push(ref);
    }
  }

  const seen = new Set<string>();
  return refs
    .filter((ref) => {
      if (seen.has(ref.id)) return false;
      seen.add(ref.id);
      return true;
    })
    .sort((a, b) => a.observedAt.localeCompare(b.observedAt) || a.id.localeCompare(b.id));
}

/**
 * Builds a governed relationship-callback candidate. Repetition of the same
 * evidence id cannot inflate support, and mutable evidence is ignored.
 */
export function assessCallbackCandidate(input: CallbackLearningInput): CallbackCandidate {
  const callback = normalized(input.callback);
  if (!callback) {
    return Object.freeze({
      callback: '',
      evidence: Object.freeze([]),
      independentEvidenceCount: 0,
      eligible: false,
      reasons: Object.freeze(['empty-callback']),
    });
  }

  const evidence = collect(input);
  const minimum = Math.max(2, Math.floor(input.minimumIndependentEvidence ?? 2));
  const reasons: string[] = [];
  if (evidence.length < minimum) reasons.push('insufficient-independent-evidence');

  return Object.freeze({
    callback: input.callback.trim(),
    evidence: Object.freeze(evidence),
    independentEvidenceCount: evidence.length,
    eligible: evidence.length >= minimum,
    reasons: Object.freeze(reasons),
  });
}

/**
 * Admits an already-assessed callback into durable Relationship state.
 * This is intentionally separate from assessment so callers can put policy /
 * approval around admission when required.
 */
export function admitRecurringCallback(
  personality: PersonalityState,
  candidate: CallbackCandidate,
  now: string,
): PersonalityState {
  if (!candidate.eligible || !candidate.callback.trim()) return personality;
  if (!Number.isFinite(Date.parse(now))) throw new RangeError('callback admission now must be a valid timestamp');

  const relationship = personality.relationship ?? {
    familiarity: 0.5,
    calibrationConfidence: 0.5,
    preferredInteractionModes: [],
    recurringCallbacks: [],
    evidence: [],
  };
  const normalizedCandidate = normalized(candidate.callback);
  const callbacks = relationship.recurringCallbacks.some((item) => normalized(item) === normalizedCandidate)
    ? [...relationship.recurringCallbacks]
    : [...relationship.recurringCallbacks, candidate.callback];

  const key=normalizedCandidate;
  const callbackEvidence=[...(relationship.callbackEvidence ?? [])]
    .filter((entry)=>normalized(entry.callback)!==key);
  callbackEvidence.push({
    callback:candidate.callback,
    evidence:candidate.evidence.map((ref)=>({...ref})),
  });

  return Object.freeze({
    ...personality,
    version: personality.version + 1,
    relationship: {
      ...relationship,
      recurringCallbacks: callbacks,
      callbackEvidence,
      evidence: [...relationship.evidence],
    },
    updatedAt: now,
  });
}

export function retireRecurringCallback(
  personality: PersonalityState,
  callback: string,
  now: string,
): PersonalityState {
  if (!personality.relationship) return personality;
  if (!Number.isFinite(Date.parse(now))) throw new RangeError('callback retirement now must be a valid timestamp');
  const target = normalized(callback);
  const recurringCallbacks = personality.relationship.recurringCallbacks
    .filter((item) => normalized(item) !== target);

  if (recurringCallbacks.length === personality.relationship.recurringCallbacks.length) return personality;

  return Object.freeze({
    ...personality,
    version: personality.version + 1,
    relationship: {
      ...personality.relationship,
      recurringCallbacks,
      callbackEvidence: personality.relationship.callbackEvidence?.filter(
        (entry)=>normalized(entry.callback)!==target
      ),
    },
    updatedAt: now,
  });
}


/**
 * Reconciles callback-specific provenance against the complete active approved
 * Memory evidence set. Only memory-backed refs are revoked here; independent
 * relationship/Hippocampus evidence survives. Legacy states without the
 * callbackEvidence submodel are left untouched until re-admitted.
 */
export function reconcileRecurringCallbackRelationship(
  relationship: PersonalityRelationshipState,
  activeMemoryEvidenceIds: ReadonlySet<string>,
  minimumIndependentEvidence=2,
): PersonalityRelationshipState {
  if (!relationship.callbackEvidence) return relationship;
  const minimum=Math.max(2,Math.floor(minimumIndependentEvidence));
  let changed=false;
  const retainedEntries:RecurringCallbackEvidence[]=[];
  const retainedCallbacks:string[]=[];

  for(const callback of relationship.recurringCallbacks){
    const key=normalized(callback);
    const managed=relationship.callbackEvidence.find(
      (entry)=>normalized(entry.callback)===key
    );
    if(!managed){
      // Legacy/unmanaged callback: do not infer revocation without provenance.
      retainedCallbacks.push(callback);
      continue;
    }
    const evidence=managed.evidence.filter(
      (ref)=>ref.source!=='memory'||activeMemoryEvidenceIds.has(ref.id)
    ).map((ref)=>({...ref}));
    if(evidence.length!==managed.evidence.length) changed=true;
    if(evidence.length<minimum){
      changed=true;
      continue;
    }
    retainedCallbacks.push(callback);
    retainedEntries.push({callback:managed.callback,evidence});
  }

  // Preserve managed evidence entries only for callbacks that still exist.
  for(const entry of relationship.callbackEvidence){
    const key=normalized(entry.callback);
    if(retainedEntries.some((item)=>normalized(item.callback)===key)) continue;
    if(relationship.recurringCallbacks.some((callback)=>normalized(callback)===key)) continue;
    // Stale orphaned entry is dropped.
    changed=true;
  }

  if(!changed) return relationship;
  return {
    ...relationship,
    recurringCallbacks:retainedCallbacks,
    callbackEvidence:retainedEntries,
  };
}

export function reconcileRecurringCallbacks(
  personality:PersonalityState,
  activeMemoryEvidenceIds:ReadonlySet<string>,
  now:string,
  minimumIndependentEvidence=2,
):PersonalityState{
  if(!personality.relationship) return personality;
  if(!Number.isFinite(Date.parse(now))) throw new RangeError('callback reconciliation now must be a valid timestamp');
  const relationship=reconcileRecurringCallbackRelationship(
    personality.relationship,
    activeMemoryEvidenceIds,
    minimumIndependentEvidence,
  );
  if(relationship===personality.relationship) return personality;
  return Object.freeze({
    ...personality,
    version:personality.version+1,
    relationship,
    updatedAt:now,
  });
}

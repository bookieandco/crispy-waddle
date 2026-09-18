import type { ContinuityLock } from './generation-orchestrator.js';
import type { ContinuityManifest } from './continuity-manifest.js';

export type ContinuityCandidate = {
  takeId: string;
  values?: Partial<Record<ContinuityLock, string>>;
  continuity?: Partial<Record<ContinuityLock, string>>;
  locked?: ContinuityLock[];
};

export type ContinuityScore = {
  takeId: string;
  score: number;
  changed: ContinuityLock[];
};

function candidateValues(candidate: ContinuityCandidate): Partial<Record<ContinuityLock, string>> {
  return candidate.values ?? candidate.continuity ?? {};
}

/**
 * Deterministic QC: locked dimensions are compared only against the canonical
 * prior manifest. Missing candidate values are not treated as a change.
 */
export function scoreContinuity(previous: ContinuityManifest, candidate: ContinuityCandidate): ContinuityScore {
  const values = candidateValues(candidate);
  const locked = previous.locked;
  const changed = locked.filter((lock) => {
    const expected = previous.values[lock];
    const actual = values[lock];
    return expected !== undefined && actual !== undefined && expected !== actual;
  });
  const score = locked.length === 0 ? 100 : Math.round(((locked.length - changed.length) / locked.length) * 100);
  return { takeId: candidate.takeId, score, changed };
}

export function rankContinuity(previous: ContinuityManifest, candidates: ContinuityCandidate[]): ContinuityScore[] {
  return candidates
    .map((candidate) => scoreContinuity(previous, candidate))
    .sort((a, b) => b.score - a.score || a.takeId.localeCompare(b.takeId));
}

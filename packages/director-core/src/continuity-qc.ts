import type { ContinuityManifest, ContinuityDimensionValue } from './continuity-manifest.js';

export type ContinuityCandidate = {
  takeId: string;
  dimensions?: Record<string, ContinuityDimensionValue>;
};

export type ContinuityScore = {
  takeId: string;
  score: number;
  changed: string[];
};

function valuesEqual(a: ContinuityDimensionValue, b: ContinuityDimensionValue): boolean {
  return Object.is(a, b);
}

export function rankContinuity(
  previous: ContinuityManifest,
  candidates: ContinuityCandidate[],
): ContinuityScore[] {
  const locked = previous.locked ?? {};
  const keys = Object.keys(locked);

  return candidates.map((candidate) => {
    const changed = keys.filter((key) => !valuesEqual(locked[key], candidate.dimensions?.[key] ?? null));
    const score = keys.length === 0 ? 100 : Math.round(((keys.length - changed.length) / keys.length) * 100);
    return { takeId: candidate.takeId, score, changed };
  }).sort((a, b) => b.score - a.score || a.takeId.localeCompare(b.takeId));
}

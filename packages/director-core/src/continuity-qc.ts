import type { ContinuityLock } from './generation-orchestrator.js';
import type { ContinuityManifest } from './continuity-manifest.js';

export type ContinuityCandidate = {
  takeId: string;
  manifest: ContinuityManifest;
};

export type ContinuityScore = {
  takeId: string;
  score: number;
  matched: ContinuityLock[];
  changed: ContinuityLock[];
  reasons: string[];
};

export function scoreContinuity(previous: ContinuityManifest, candidate: ContinuityCandidate): ContinuityScore {
  const locks = previous.locks;
  const matched: ContinuityLock[] = [];
  const changed: ContinuityLock[] = [];
  const reasons: string[] = [];

  for (const lock of locks) {
    const same = lock === 'character'
      ? sameSet(previous.characterIds, candidate.manifest.characterIds)
      : lock === 'wardrobe'
        ? sameNote(previous.visualNotes, candidate.manifest.visualNotes, 'wardrobe')
        : lock === 'camera'
          ? sameCinematography(previous, candidate.manifest)
          : lock === 'lens'
            ? previous.cinematography?.lens === candidate.manifest.cinematography?.lens
            : lock === 'lighting'
              ? previous.cinematography?.lighting === candidate.manifest.cinematography?.lighting
              : lock === 'color'
                ? previous.cinematography?.color === candidate.manifest.cinematography?.color
                : lock === 'audio'
                  ? sameNote(previous.audioNotes, candidate.manifest.audioNotes)
                  : true;
    (same ? matched : changed).push(lock);
  }

  if (changed.length) reasons.push(`Changed locked dimensions: ${changed.join(', ')}`);
  if (!changed.length) reasons.push('All requested continuity locks match.');
  const score = locks.length ? Math.round((matched.length / locks.length) * 100) : 100;
  return { takeId: candidate.takeId, score, matched, changed, reasons };
}

function sameSet(a: string[], b: string[]) { return a.length === b.length && a.every((x) => b.includes(x)); }
function sameCinematography(a: ContinuityManifest, b: ContinuityManifest) { return a.cinematography?.shot === b.cinematography?.shot && a.cinematography?.movement === b.cinematography?.movement; }
function sameNote(a?: string[], b?: string[], token?: string) {
  if (!token) return JSON.stringify(a ?? []) === JSON.stringify(b ?? []);
  return (a ?? []).filter((x) => x.toLowerCase().includes(token)).join('|') === (b ?? []).filter((x) => x.toLowerCase().includes(token)).join('|');
}

export function rankContinuity(previous: ContinuityManifest, candidates: ContinuityCandidate[]) {
  return candidates.map((candidate) => scoreContinuity(previous, candidate)).sort((a, b) => b.score - a.score);
}

import type { ContinuityLock } from './generation-orchestrator.js';
import type { ContinuityManifest } from './continuity-manifest.js';

export type ContinuityCandidate = { takeId: string; manifest: ContinuityManifest; previewUri?: string; thumbnailUri?: string };
export type ContinuityScore = { takeId: string; score: number; matched: ContinuityLock[]; changed: ContinuityLock[]; reasons: string[]; previewUri?: string; thumbnailUri?: string };

export function scoreContinuity(previous: ContinuityManifest, candidate: ContinuityCandidate): ContinuityScore {
  const matched: ContinuityLock[] = [], changed: ContinuityLock[] = [];
  for (const lock of previous.locks) {
    const same = lock === 'character' ? sameSet(previous.characterIds, candidate.manifest.characterIds)
      : lock === 'wardrobe' ? sameNote(previous.visualNotes, candidate.manifest.visualNotes, 'wardrobe')
      : lock === 'camera' ? sameCinematography(previous, candidate.manifest)
      : lock === 'lens' ? previous.cinematography?.lens === candidate.manifest.cinematography?.lens
      : lock === 'lighting' ? previous.cinematography?.lighting === candidate.manifest.cinematography?.lighting
      : lock === 'color' ? previous.cinematography?.color === candidate.manifest.cinematography?.color
      : lock === 'audio' ? sameNote(previous.audioNotes, candidate.manifest.audioNotes)
      : true;
    (same ? matched : changed).push(lock);
  }
  const reasons = changed.length ? [`Changed locked dimensions: ${changed.join(', ')}`] : ['All requested continuity locks match.'];
  return { takeId: candidate.takeId, score: previous.locks.length ? Math.round(matched.length / previous.locks.length * 100) : 100, matched, changed, reasons, previewUri: candidate.previewUri, thumbnailUri: candidate.thumbnailUri };
}
function sameSet(a: string[], b: string[]) { return a.length === b.length && a.every((x) => b.includes(x)); }
function sameCinematography(a: ContinuityManifest, b: ContinuityManifest) { return a.cinematography?.shot === b.cinematography?.shot && a.cinematography?.movement === b.cinematography?.movement; }
function sameNote(a?: string[], b?: string[], token?: string) { if (!token) return JSON.stringify(a ?? []) === JSON.stringify(b ?? []); return (a ?? []).filter((x) => x.toLowerCase().includes(token)).join('|') === (b ?? []).filter((x) => x.toLowerCase().includes(token)).join('|'); }
export function rankContinuity(previous: ContinuityManifest, candidates: ContinuityCandidate[]) { return candidates.map((candidate) => scoreContinuity(previous, candidate)).sort((a, b) => b.score - a.score); }

import type { TranscriptSegment, TranscriptWord } from './transcript-audio-bridge.js';

export type FalseStart = {
  segmentId: string;
  startSeconds: number;
  endSeconds: number;
  text: string;
  confidence: number;
  reason: 'restart' | 'repeated-fragment' | 'incomplete-fragment';
};

export type FalseStartPolicy = {
  maxWords: number;
  minConfidence: number;
  maxRestartGapSeconds: number;
};

/**
 * Detects likely false starts from transcript structure only. It never edits media
 * and deliberately returns candidates for approval rather than asserting intent.
 */
export function detectFalseStarts(
  segments: TranscriptSegment[],
  policy: FalseStartPolicy,
): FalseStart[] {
  const ordered = [...segments].sort((a, b) => a.startSeconds - b.startSeconds);
  const results: FalseStart[] = [];

  for (let i = 0; i < ordered.length; i += 1) {
    const current = ordered[i];
    const words = current.words ?? [];
    const confidence = averageConfidence(words);
    const next = ordered[i + 1];
    if (words.length === 0 || words.length > policy.maxWords || confidence < policy.minConfidence || !next) continue;

    const gap = next.startSeconds - current.endSeconds;
    const currentTokens = normalize(current.text);
    const nextTokens = normalize(next.text);
    const repeated = currentTokens.length > 0 && nextTokens.startsWith(currentTokens);

    if (gap <= policy.maxRestartGapSeconds && repeated) {
      results.push({
        segmentId: current.id,
        startSeconds: current.startSeconds,
        endSeconds: current.endSeconds,
        text: current.text,
        confidence,
        reason: 'restart',
      });
      continue;
    }

    if (currentTokens.length > 0 && nextTokens.includes(currentTokens) && gap <= policy.maxRestartGapSeconds) {
      results.push({
        segmentId: current.id,
        startSeconds: current.startSeconds,
        endSeconds: current.endSeconds,
        text: current.text,
        confidence,
        reason: 'repeated-fragment',
      });
    }
  }

  return results;
}

function averageConfidence(words: TranscriptWord[]): number {
  const values = words.map(word => word.confidence).filter((value): value is number => typeof value === 'number');
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 1;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

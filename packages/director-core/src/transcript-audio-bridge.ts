import type { AudioEditIntent } from './audio-edit-command.js';

export type TranscriptWord = {
  text: string;
  startSeconds: number;
  endSeconds: number;
  confidence?: number;
};

export type TranscriptSegment = {
  id: string;
  startSeconds: number;
  endSeconds: number;
  text: string;
  words?: TranscriptWord[];
};

export type TranscriptCutPolicy = {
  pauseThresholdSeconds: number;
  removeLeadingSilence?: boolean;
  removeTrailingSilence?: boolean;
};

/** Converts transcript timing into non-destructive dialogue edit intents. */
export function createPauseCutIntents(
  clipId: string,
  segments: TranscriptSegment[],
  policy: TranscriptCutPolicy,
): AudioEditIntent[] {
  const intents: AudioEditIntent[] = [];
  const ordered = [...segments].sort((a, b) => a.startSeconds - b.startSeconds);

  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1];
    const current = ordered[index];
    const pause = current.startSeconds - previous.endSeconds;
    if (pause < policy.pauseThresholdSeconds) continue;

    intents.push({
      command: {
        type: 'audio-cut',
        clipId,
        startSeconds: previous.endSeconds,
        endSeconds: current.startSeconds,
      },
      reason: `Remove ${pause.toFixed(2)}s pause between transcript segments`,
      requiresApproval: true,
    });
  }

  return intents;
}

export type AudioTrackRole = 'dialogue' | 'music' | 'sfx' | 'foley' | 'ambience' | 'voiceover' | 'other';

export type AudioEditCommand =
  | { type: 'audio-cut'; clipId: string; startSeconds: number; endSeconds: number }
  | { type: 'audio-trim'; clipId: string; startSeconds: number; durationSeconds: number }
  | { type: 'audio-move'; clipId: string; startSeconds: number }
  | { type: 'audio-fade'; clipId: string; fadeInSeconds?: number; fadeOutSeconds?: number }
  | { type: 'audio-gain'; clipId: string; gainDb: number }
  | { type: 'audio-mute'; clipId: string; muted: boolean }
  | { type: 'audio-place'; assetId: string; trackRole: AudioTrackRole; startSeconds: number; durationSeconds: number };

export type AudioEditIntent = {
  command: AudioEditCommand;
  reason?: string;
  requiresApproval?: boolean;
};

/** Audio remains independently editable from video and is never inferred from a video mutation. */
export function createAudioEditIntent(command: AudioEditCommand, reason?: string): AudioEditIntent {
  return { command, reason, requiresApproval: true };
}

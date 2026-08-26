import type { EditableTimeline, TimelineClip } from './timeline-model.js';
import type { AudioEditIntent } from './audio-edit-command.js';

function findClip(timeline: EditableTimeline, clipId: string): { trackId: string; clip: TimelineClip } | null {
  for (const track of timeline.tracks) {
    const clip = track.clips.find(candidate => candidate.id === clipId);
    if (clip) return { trackId: track.id, clip };
  }
  return null;
}

/** Applies a dialogue/audio cut locally to the referenced clip. It does not ripple video or other audio tracks. */
export function applyAudioEditIntent(timeline: EditableTimeline, intent: AudioEditIntent): EditableTimeline {
  const command = intent.command;
  const found = 'clipId' in command ? findClip(timeline, command.clipId) : null;
  if (!found) return timeline;

  const track = timeline.tracks.find(candidate => candidate.id === found.trackId);
  if (!track) return timeline;

  let nextClip: TimelineClip = found.clip;
  switch (command.type) {
    case 'audio-cut': {
      const cutDuration = Math.max(0, command.endSeconds - command.startSeconds);
      const clipEnd = found.clip.startSeconds + found.clip.durationSeconds;
      if (command.startSeconds < found.clip.startSeconds || command.endSeconds > clipEnd || cutDuration === 0) return timeline;
      nextClip = { ...found.clip, durationSeconds: Math.max(0, found.clip.durationSeconds - cutDuration) };
      break;
    }
    case 'audio-trim':
      nextClip = { ...found.clip, startSeconds: command.startSeconds, durationSeconds: command.durationSeconds };
      break;
    case 'audio-move':
      nextClip = { ...found.clip, startSeconds: command.startSeconds };
      break;
    case 'audio-fade':
      nextClip = { ...found.clip, metadata: { ...found.clip.metadata, fadeInSeconds: command.fadeInSeconds ?? 0, fadeOutSeconds: command.fadeOutSeconds ?? 0 } };
      break;
    case 'audio-gain':
      nextClip = { ...found.clip, metadata: { ...found.clip.metadata, gainDb: command.gainDb } };
      break;
    case 'audio-mute':
      nextClip = { ...found.clip, metadata: { ...found.clip.metadata, muted: command.muted } };
      break;
    case 'audio-place':
      return {
        ...timeline,
        tracks: timeline.tracks.map(candidate => candidate.id === found.trackId ? { ...candidate, clips: [...candidate.clips, { id: crypto.randomUUID(), trackId: candidate.id, assetId: command.assetId, startSeconds: command.startSeconds, durationSeconds: command.durationSeconds, metadata: { role: command.trackRole } }] } : candidate),
      };
    default:
      return timeline;
  }

  return {
    ...timeline,
    tracks: timeline.tracks.map(candidate => candidate.id === found.trackId ? { ...candidate, clips: candidate.clips.map(clip => clip.id === found.clip.id ? nextClip : clip) } : candidate),
  };
}

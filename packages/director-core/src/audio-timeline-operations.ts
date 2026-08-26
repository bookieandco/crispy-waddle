import type { EditableTimeline, TimelineClip } from './timeline-model.js';
import type { AudioEditIntent } from './audio-edit-command.js';
import { splitAudioClipForCut } from './audio-media-cut.js';

function findClip(timeline: EditableTimeline, clipId: string): { trackId: string; clip: TimelineClip } | null {
  for (const track of timeline.tracks) {
    const clip = track.clips.find(candidate => candidate.id === clipId);
    if (clip) return { trackId: track.id, clip };
  }
  return null;
}

/** Applies an audio edit without modifying the source asset. */
export function applyAudioEditIntent(timeline: EditableTimeline, intent: AudioEditIntent): EditableTimeline {
  const command = intent.command;
  const found = 'clipId' in command ? findClip(timeline, command.clipId) : null;
  if (!found) return timeline;

  let nextClips: TimelineClip[];
  switch (command.type) {
    case 'audio-cut': {
      nextClips = splitAudioClipForCut(found.clip, {
        startSeconds: command.startSeconds,
        endSeconds: command.endSeconds,
      });
      break;
    }
    case 'audio-trim':
      nextClips = [{ ...found.clip, startSeconds: command.startSeconds, durationSeconds: command.durationSeconds, sourceOutSeconds: (found.clip.sourceInSeconds ?? 0) + command.durationSeconds }];
      break;
    case 'audio-move':
      nextClips = [{ ...found.clip, startSeconds: command.startSeconds }];
      break;
    case 'audio-fade':
      nextClips = [{ ...found.clip, metadata: { ...found.clip.metadata, fadeInSeconds: command.fadeInSeconds ?? 0, fadeOutSeconds: command.fadeOutSeconds ?? 0 } }];
      break;
    case 'audio-gain':
      nextClips = [{ ...found.clip, metadata: { ...found.clip.metadata, gainDb: command.gainDb } }];
      break;
    case 'audio-mute':
      nextClips = [{ ...found.clip, metadata: { ...found.clip.metadata, muted: command.muted } }];
      break;
    default:
      return timeline;
  }

  return {
    ...timeline,
    tracks: timeline.tracks.map(track => track.id === found.trackId
      ? { ...track, clips: track.clips.flatMap(clip => clip.id === found.clip.id ? nextClips : [clip]) }
      : track),
  };
}

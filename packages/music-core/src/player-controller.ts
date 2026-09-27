import type { Track } from "./types.js";
import { createPlaybackState, nextTrack, playTrack, previousTrack, setQueue, type PlaybackState } from "./player.js";

export interface PersistedPlayerState {
  queue: Track[];
  queueIndex: number;
  track: Track | null;
  positionMs: number;
  shuffle: boolean;
  repeat: PlaybackState["repeat"];
}

export function serializePlayerState(state: PlaybackState): PersistedPlayerState {
  return {
    queue: state.queue,
    queueIndex: state.queueIndex,
    track: state.track,
    positionMs: Math.max(0, Math.round(state.positionMs)),
    shuffle: state.shuffle,
    repeat: state.repeat,
  };
}

export function restorePlayerState(saved?: Partial<PersistedPlayerState> | null): PlaybackState {
  const base = createPlaybackState();
  if (!saved) return base;
  const queue = Array.isArray(saved.queue) ? saved.queue : [];
  const queueIndex = Number.isInteger(saved.queueIndex) ? Math.max(-1, Math.min(saved.queueIndex!, queue.length - 1)) : -1;
  const track = saved.track ?? (queueIndex >= 0 ? queue[queueIndex] : null);
  return {
    ...base,
    queue,
    queueIndex,
    track,
    positionMs: Math.max(0, Number(saved.positionMs) || 0),
    shuffle: Boolean(saved.shuffle),
    repeat: saved.repeat === "track" || saved.repeat === "queue" ? saved.repeat : "off",
    playing: false,
  };
}

export function addToQueue(state: PlaybackState, track: Track, mode: "last" | "next" = "last"): PlaybackState {
  const queue = state.queue.filter((item) => item.id !== track.id);
  if (mode === "next" && state.queueIndex >= 0) queue.splice(Math.min(state.queueIndex + 1, queue.length), 0, track);
  else queue.push(track);
  const queueIndex = state.track ? queue.findIndex((item) => item.id === state.track!.id) : -1;
  return { ...state, queue, queueIndex };
}

export function removeFromQueue(state: PlaybackState, trackId: string): PlaybackState {
  const queue = state.queue.filter((item) => item.id !== trackId);
  if (state.track?.id === trackId) {
    const nextIndex = Math.min(Math.max(0, state.queueIndex), queue.length - 1);
    return { ...state, queue, queueIndex: queue.length ? nextIndex : -1, track: queue[nextIndex] ?? null, positionMs: 0, playing: Boolean(queue.length && state.playing) };
  }
  const queueIndex = state.track ? queue.findIndex((item) => item.id === state.track!.id) : -1;
  return { ...state, queue, queueIndex };
}

export function reorderQueue(state: PlaybackState, from: number, to: number): PlaybackState {
  if (from < 0 || from >= state.queue.length || to < 0 || to >= state.queue.length || from === to) return state;
  const queue = [...state.queue];
  const [item] = queue.splice(from, 1);
  queue.splice(to, 0, item);
  return { ...state, queue, queueIndex: state.track ? queue.findIndex((entry) => entry.id === state.track!.id) : -1 };
}

export function toggleShuffle(state: PlaybackState): PlaybackState { return { ...state, shuffle: !state.shuffle }; }
export function cycleRepeat(state: PlaybackState): PlaybackState {
  return { ...state, repeat: state.repeat === "off" ? "queue" : state.repeat === "queue" ? "track" : "off" };
}
export { createPlaybackState, nextTrack, playTrack, previousTrack, setQueue };

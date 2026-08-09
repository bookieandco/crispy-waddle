import type { ListeningEvent, Track } from "./types.js";

export interface PlaybackState {
  track: Track | null;
  queue: Track[];
  queueIndex: number;
  positionMs: number;
  playing: boolean;
  shuffle: boolean;
  repeat: "off" | "track" | "queue";
}

export function createPlaybackState(): PlaybackState {
  return { track: null, queue: [], queueIndex: -1, positionMs: 0, playing: false, shuffle: false, repeat: "off" };
}

export function playTrack(state: PlaybackState, track: Track): PlaybackState {
  const index = state.queue.findIndex((item) => item.id === track.id);
  return { ...state, track, queueIndex: index >= 0 ? index : state.queueIndex, positionMs: 0, playing: true };
}

export function setQueue(state: PlaybackState, queue: Track[], startIndex = 0): PlaybackState {
  const track = queue[startIndex] ?? null;
  return { ...state, queue: [...queue], queueIndex: track ? startIndex : -1, track, positionMs: 0, playing: Boolean(track) };
}

export function nextTrack(state: PlaybackState): PlaybackState {
  if (!state.queue.length) return { ...state, track: null, playing: false };
  if (state.repeat === "track") return { ...state, positionMs: 0, playing: true };
  const next = state.shuffle ? Math.floor(Math.random() * state.queue.length) : state.queueIndex + 1;
  if (next >= state.queue.length) {
    return state.repeat === "queue" ? { ...state, queueIndex: 0, track: state.queue[0], positionMs: 0, playing: true } : { ...state, playing: false };
  }
  return { ...state, queueIndex: next, track: state.queue[next], positionMs: 0, playing: true };
}

export function previousTrack(state: PlaybackState): PlaybackState {
  if (!state.queue.length) return state;
  const previous = Math.max(0, state.queueIndex - 1);
  return { ...state, queueIndex: previous, track: state.queue[previous], positionMs: 0, playing: true };
}

export function createListeningEvent(userId: string, state: PlaybackState, startedAt: string): ListeningEvent | null {
  if (!state.track) return null;
  return { id: `listen_${state.track.id}_${Date.now()}`, userId, trackId: state.track.id, startedAt, positionMs: state.positionMs, completed: false, skipped: false };
}

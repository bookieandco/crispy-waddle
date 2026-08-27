import type { ListeningEvent, Track } from "./types.js";
import type { MusicControllerState } from "./music-controller.js";

/** Compatibility facade: MusicControllerState is the single playback state authority. */
export type PlaybackState = MusicControllerState;

export function createPlaybackState(): PlaybackState {
  return {
    queue: [],
    queueIndex: -1,
    playing: false,
    shuffle: false,
    repeat: "off",
    positionMs: 0,
    volume: 1,
    offlineOnly: false,
  };
}

export function playTrack(state: PlaybackState, track: Track): PlaybackState {
  const existing = state.queue.findIndex((item) => item.id === track.id);
  if (existing >= 0) return { ...state, queueIndex: existing, playing: true, positionMs: 0 };
  return { ...state, queue: [...state.queue, track], queueIndex: state.queue.length, playing: true, positionMs: 0 };
}

export function setQueue(state: PlaybackState, queue: Track[], startIndex = 0): PlaybackState {
  const track = queue[startIndex] ?? null;
  return { ...state, queue: [...queue], queueIndex: track ? startIndex : -1, playing: Boolean(track), positionMs: 0 };
}

export function nextTrack(state: PlaybackState): PlaybackState {
  if (!state.queue.length) return { ...state, playing: false };
  if (state.repeat === "one") return { ...state, positionMs: 0, playing: true };
  if (state.shuffle) {
    const candidates = state.queue.map((_, index) => index).filter((index) => index !== state.queueIndex);
    if (candidates.length) {
      const index = candidates[Math.floor(Math.random() * candidates.length)];
      return { ...state, queueIndex: index, positionMs: 0, playing: true };
    }
  }
  if (state.queueIndex < state.queue.length - 1) return { ...state, queueIndex: state.queueIndex + 1, positionMs: 0, playing: true };
  if (state.repeat === "all") return { ...state, queueIndex: 0, positionMs: 0, playing: true };
  return { ...state, playing: false, positionMs: 0 };
}

export function previousTrack(state: PlaybackState): PlaybackState {
  if (!state.queue.length) return state;
  if (state.positionMs > 5000) return { ...state, positionMs: 0 };
  const index = Math.max(0, state.queueIndex - 1);
  return { ...state, queueIndex: index, positionMs: 0, playing: true };
}

export function createListeningEvent(userId: string, state: PlaybackState, startedAt: string): ListeningEvent | null {
  const track = state.queue[state.queueIndex];
  if (!track) return null;
  return { id: `listen_${track.id}_${Date.now()}`, userId, trackId: track.id, startedAt, positionMs: state.positionMs, completed: false, skipped: false };
}

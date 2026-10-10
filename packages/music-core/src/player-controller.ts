import type { Track } from "./types.js";
import { createPlaybackState, createShuffleBag, nextTrack, playTrack, previousTrack, setQueue, type PlaybackState } from "./player.js";

export interface PersistedPlayerState {
  queue: Track[];
  queueIndex: number;
  track: Track | null;
  positionMs: number;
  shuffle: boolean;
  repeat: PlaybackState["repeat"];
  shuffleRemaining: string[];
  shuffleHistory: string[];
}

export function serializePlayerState(state: PlaybackState): PersistedPlayerState {
  return {
    queue: state.queue, queueIndex: state.queueIndex, track: state.track,
    positionMs: Math.max(0, Math.round(state.positionMs)),
    shuffle: state.shuffle, repeat: state.repeat,
    shuffleRemaining: state.shuffleRemaining, shuffleHistory: state.shuffleHistory,
  };
}

export function restorePlayerState(saved?: Partial<PersistedPlayerState> | null): PlaybackState {
  const base = createPlaybackState();
  if (!saved) return base;
  const queue = Array.isArray(saved.queue) ? saved.queue.filter(
    (item): item is Track => Boolean(item) && typeof item.id === "string" && typeof item.title === "string" && Array.isArray(item.artistIds),
  ) : [];
  const queueIndex = Number.isInteger(saved.queueIndex)
    ? Math.max(-1, Math.min(saved.queueIndex!, queue.length - 1)) : -1;
  const track = saved.track && queue.some(item => item.id === saved.track?.id)
    ? queue.find(item => item.id === saved.track?.id)!
    : (queueIndex >= 0 ? queue[queueIndex] : null);
  const ids = new Set(queue.map(item => item.id));
  const history = Array.isArray(saved.shuffleHistory) ? saved.shuffleHistory.filter(
    (id): id is string => typeof id === "string" && ids.has(id) && id !== track?.id,
  ) : [];
  const remaining = Array.isArray(saved.shuffleRemaining) ? [...new Set(saved.shuffleRemaining.filter(
    (id): id is string => typeof id === "string" && ids.has(id) && id !== track?.id && !history.includes(id),
  ))] : [];
  const shuffle = Boolean(saved.shuffle);
  return {
    ...base, queue, queueIndex: track ? queue.findIndex(item => item.id === track.id) : -1,
    track, positionMs: Math.max(0, Number(saved.positionMs) || 0),
    shuffle, repeat: saved.repeat === "track" || saved.repeat === "queue" ? saved.repeat : "off",
    shuffleHistory: shuffle ? history : [],
    shuffleRemaining: shuffle
      ? (history.length || remaining.length ? remaining : createShuffleBag(queue, track?.id))
      : [],
    playing: false,
  };
}

export function addToQueue(state: PlaybackState, track: Track, mode: "last" | "next" = "last"): PlaybackState {
  const existing = state.queue.some(item => item.id === track.id);
  const queue = state.queue.filter(item => item.id !== track.id);
  if (mode === "next" && state.queueIndex >= 0) {
    const nowIndex = queue.findIndex(item => item.id === state.track?.id);
    queue.splice(Math.min(nowIndex + 1, queue.length), 0, track);
  } else queue.push(track);
  const queueIndex = state.track ? queue.findIndex(item => item.id === state.track!.id) : -1;
  let remaining = state.shuffleRemaining.filter(id => id !== track.id);
  if (state.shuffle && track.id !== state.track?.id) {
    if (mode === "next") remaining.unshift(track.id);
    else if (!existing || state.shuffleRemaining.includes(track.id)) remaining.push(track.id);
  }
  return { ...state, queue, queueIndex, shuffleRemaining: remaining,
    shuffleHistory: state.shuffleHistory.filter(id => id !== track.id) };
}

export function removeFromQueue(state: PlaybackState, trackId: string): PlaybackState {
  const queue = state.queue.filter(item => item.id !== trackId);
  const remaining = state.shuffleRemaining.filter(id => id !== trackId);
  const history = state.shuffleHistory.filter(id => id !== trackId);
  if (state.track?.id === trackId) {
    const nextIndex = Math.min(Math.max(0, state.queueIndex), queue.length - 1);
    return { ...state, queue, queueIndex: queue.length ? nextIndex : -1,
      track: queue[nextIndex] ?? null, positionMs: 0, playing: Boolean(queue.length && state.playing),
      shuffleRemaining: remaining, shuffleHistory: history };
  }
  const queueIndex = state.track ? queue.findIndex(item => item.id === state.track!.id) : -1;
  return { ...state, queue, queueIndex, shuffleRemaining: remaining, shuffleHistory: history };
}

export function reorderQueue(state: PlaybackState, from: number, to: number): PlaybackState {
  if (from < 0 || from >= state.queue.length || to < 0 || to >= state.queue.length || from === to) return state;
  const queue = [...state.queue];
  const [item] = queue.splice(from, 1);
  queue.splice(to, 0, item);
  return { ...state, queue, queueIndex: state.track ? queue.findIndex(entry => entry.id === state.track!.id) : -1 };
}

export function toggleShuffle(state: PlaybackState): PlaybackState {
  if (state.shuffle) return { ...state, shuffle: false, shuffleRemaining: [], shuffleHistory: [] };
  return { ...state, shuffle: true, shuffleRemaining: createShuffleBag(state.queue, state.track?.id), shuffleHistory: [] };
}
export function cycleRepeat(state: PlaybackState): PlaybackState {
  return { ...state, repeat: state.repeat === "off" ? "queue" : state.repeat === "queue" ? "track" : "off" };
}
export { createPlaybackState, nextTrack, playTrack, previousTrack, setQueue };

import type { ListeningEvent, Track } from "./types.js";

/** A shuffle bag is consumed once per pass: no random replacement or immediate repeat. */
export interface PlaybackState {
  track: Track | null;
  queue: Track[];
  queueIndex: number;
  positionMs: number;
  playing: boolean;
  shuffle: boolean;
  repeat: "off" | "track" | "queue";
  shuffleRemaining: string[];
  shuffleHistory: string[];
}

export function createPlaybackState(): PlaybackState {
  return { track: null, queue: [], queueIndex: -1, positionMs: 0, playing: false,
    shuffle: false, repeat: "off", shuffleRemaining: [], shuffleHistory: [] };
}

function shuffledIds(queue: Track[], excludeId?: string): string[] {
  const ids = [...new Set(queue.map(track => track.id).filter(id => id !== excludeId))];
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids;
}

export function createShuffleBag(queue: Track[], currentId?: string): string[] {
  return shuffledIds(queue, currentId);
}

export function playTrack(state: PlaybackState, track: Track): PlaybackState {
  const index = state.queue.findIndex(item => item.id === track.id);
  return { ...state, track, queueIndex: index >= 0 ? index : state.queueIndex,
    positionMs: 0, playing: true,
    shuffleRemaining: state.shuffle ? createShuffleBag(state.queue, track.id) : [],
    shuffleHistory: [] };
}

export function setQueue(state: PlaybackState, queue: Track[], startIndex = 0): PlaybackState {
  const index = Number.isInteger(startIndex) && startIndex >= 0 && startIndex < queue.length ? startIndex : 0;
  const track = queue[index] ?? null;
  return { ...state, queue: [...queue], queueIndex: track ? index : -1,
    track, positionMs: 0, playing: Boolean(track),
    shuffleRemaining: state.shuffle ? createShuffleBag(queue, track?.id) : [],
    shuffleHistory: [] };
}

export function nextTrack(state: PlaybackState): PlaybackState {
  if (!state.queue.length) return { ...state, track: null, queueIndex: -1, playing: false };
  if (state.repeat === "track") return { ...state, positionMs: 0, playing: true };
  if (!state.shuffle) {
    const next = state.queueIndex + 1;
    if (next >= state.queue.length) {
      return state.repeat === "queue"
        ? { ...state, queueIndex: 0, track: state.queue[0], positionMs: 0, playing: true }
        : { ...state, playing: false };
    }
    return { ...state, queueIndex: next, track: state.queue[next], positionMs: 0, playing: true };
  }
  const ids = new Set(state.queue.map(track => track.id));
  let remaining = state.shuffleRemaining.filter(id => ids.has(id) && id !== state.track?.id);
  const history = state.shuffleHistory.filter(id => ids.has(id));
  // Compatibility with older saved state, or externally constructed shuffle state.
  if (!remaining.length && !history.length) remaining = createShuffleBag(state.queue, state.track?.id);
  if (!remaining.length) {
    if (state.repeat !== "queue") return { ...state, playing: false, shuffleRemaining: [] };
    remaining = createShuffleBag(state.queue, state.track?.id);
  }
  const [id, ...tail] = remaining;
  if (!id) return { ...state, playing: false };
  const index = state.queue.findIndex(track => track.id === id);
  if (index < 0) return { ...state, playing: false };
  return { ...state, track: state.queue[index], queueIndex: index, positionMs: 0, playing: true,
    shuffleRemaining: tail, shuffleHistory: state.track ? [...history, state.track.id] : history };
}

export function previousTrack(state: PlaybackState): PlaybackState {
  if (!state.queue.length) return state;
  if (state.shuffle && state.shuffleHistory.length) {
    const valid = new Set(state.queue.map(track => track.id));
    const history = state.shuffleHistory.filter(id => valid.has(id));
    const previousId = history.pop();
    const index = state.queue.findIndex(track => track.id === previousId);
    if (index >= 0) return {
      ...state, track: state.queue[index], queueIndex: index, positionMs: 0, playing: true,
      shuffleHistory: history,
      shuffleRemaining: state.track
        ? [state.track.id, ...state.shuffleRemaining.filter(id => id !== state.track?.id && id !== previousId)]
        : state.shuffleRemaining,
    };
  }
  const previous = Math.max(0, state.queueIndex - 1);
  return { ...state, queueIndex: previous, track: state.queue[previous], positionMs: 0, playing: true };
}

export function createListeningEvent(userId: string, state: PlaybackState, startedAt: string): ListeningEvent | null {
  if (!state.track) return null;
  return { id: `listen_${state.track.id}_${Date.now()}`, userId,
    trackId: state.track.id, startedAt, positionMs: state.positionMs, completed: false, skipped: false };
}

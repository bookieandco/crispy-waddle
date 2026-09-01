import type { MediaKind } from './index';
import type { MediaSessionState, PlaybackTarget } from './casting';
import type { ResolvedPlaybackSource } from './playback-resolver';

export interface MediaQueueItem {
  id: string;
  titleId: string;
  title: string;
  kind: MediaKind;
  playback: ResolvedPlaybackSource;
  posterUrl?: string;
  durationSeconds?: number;
}

export interface MediaPlaybackStoreState {
  current: MediaQueueItem | null;
  queue: MediaQueueItem[];
  queueIndex: number;
  playerState: MediaSessionState | null;
  repeat: 'off' | 'one' | 'all';
  shuffle: boolean;
}

export interface MediaPlaybackStore {
  getState(): MediaPlaybackStoreState;
  subscribe(listener: (state: MediaPlaybackStoreState) => void): () => void;
  setCurrent(item: MediaQueueItem | null, queueIndex?: number): void;
  setQueue(items: MediaQueueItem[], queueIndex?: number): void;
  addToQueue(item: MediaQueueItem): void;
  removeFromQueue(itemId: string): void;
  clearQueue(): void;
  updatePlayerState(state: MediaSessionState): void;
  setRepeat(mode: MediaPlaybackStoreState['repeat']): void;
  setShuffle(enabled: boolean): void;
  reset(): void;
}

const INITIAL_STATE: MediaPlaybackStoreState = {
  current: null,
  queue: [],
  queueIndex: -1,
  playerState: null,
  repeat: 'off',
  shuffle: false,
};

function cloneState(state: MediaPlaybackStoreState): MediaPlaybackStoreState {
  return { ...state, queue: [...state.queue] };
}

export function createMediaPlaybackStore(initial: Partial<MediaPlaybackStoreState> = {}): MediaPlaybackStore {
  let state: MediaPlaybackStoreState = { ...INITIAL_STATE, ...initial, queue: [...(initial.queue ?? [])] };
  const listeners = new Set<(next: MediaPlaybackStoreState) => void>();
  const publish = (next: MediaPlaybackStoreState) => {
    state = next;
    const snapshot = cloneState(state);
    listeners.forEach((listener) => listener(snapshot));
  };

  return {
    getState: () => cloneState(state),
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    setCurrent(item, queueIndex = item ? Math.max(0, queueIndex) : -1) {
      publish({ ...state, current: item, queueIndex });
    },
    setQueue(items, queueIndex = items.length ? 0 : -1) {
      const nextQueue = [...items];
      const nextIndex = nextQueue.length ? Math.min(Math.max(0, queueIndex), nextQueue.length - 1) : -1;
      publish({ ...state, queue: nextQueue, queueIndex: nextIndex, current: nextIndex >= 0 ? nextQueue[nextIndex] : null });
    },
    addToQueue(item) {
      publish({ ...state, queue: [...state.queue, item] });
    },
    removeFromQueue(itemId) {
      const removedIndex = state.queue.findIndex((item) => item.id === itemId);
      if (removedIndex < 0) return;
      const nextQueue = state.queue.filter((item) => item.id !== itemId);
      let nextIndex = state.queueIndex;
      if (!nextQueue.length) nextIndex = -1;
      else if (removedIndex < state.queueIndex) nextIndex = state.queueIndex - 1;
      else if (removedIndex === state.queueIndex) nextIndex = Math.min(state.queueIndex, nextQueue.length - 1);
      publish({ ...state, queue: nextQueue, queueIndex: nextIndex, current: nextIndex >= 0 ? nextQueue[nextIndex] : null });
    },
    clearQueue() { publish({ ...state, queue: [], queueIndex: -1, current: null }); },
    updatePlayerState(playerState) { publish({ ...state, playerState }); },
    setRepeat(repeat) { publish({ ...state, repeat }); },
    setShuffle(shuffle) { publish({ ...state, shuffle }); },
    reset() { publish(cloneState(INITIAL_STATE)); },
  };
}

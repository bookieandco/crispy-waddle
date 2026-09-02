import type { MediaKind } from './index';
import type { MediaSessionState } from './casting';
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
  next(): MediaQueueItem | null;
  previous(): MediaQueueItem | null;
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

function assertUniqueQueueIds(items: readonly MediaQueueItem[]): void {
  const ids = new Set<string>();
  for (const item of items) {
    if (!item.id) throw new Error('Media queue item identity is required.');
    if (ids.has(item.id)) throw new Error(`Duplicate media queue item: ${item.id}`);
    ids.add(item.id);
  }
}

export function createMediaPlaybackStore(initial: Partial<MediaPlaybackStoreState> = {}): MediaPlaybackStore {
  assertUniqueQueueIds(initial.queue ?? []);
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
      if (!item) {
        publish({ ...state, current: null, queueIndex: -1 });
        return;
      }
      const existingIndex = state.queue.findIndex((entry) => entry.id === item.id);
      if (existingIndex >= 0) {
        const nextIndex = Math.min(Math.max(0, queueIndex), state.queue.length - 1);
        if (state.queue[nextIndex]?.id !== item.id) throw new Error('Current media queue item does not match queue index.');
        publish({ ...state, current: state.queue[nextIndex], queueIndex: nextIndex });
        return;
      }
      if (state.queue.length) throw new Error('Current media queue item must belong to the queue.');
      publish({ ...state, current: item, queueIndex: 0 });
    },
    setQueue(items, queueIndex = items.length ? 0 : -1) {
      assertUniqueQueueIds(items);
      const nextQueue = [...items];
      const nextIndex = nextQueue.length ? Math.min(Math.max(0, queueIndex), nextQueue.length - 1) : -1;
      publish({ ...state, queue: nextQueue, queueIndex: nextIndex, current: nextIndex >= 0 ? nextQueue[nextIndex] : null });
    },
    addToQueue(item) {
      if (!item.id) throw new Error('Media queue item identity is required.');
      if (state.queue.some((entry) => entry.id === item.id)) throw new Error(`Duplicate media queue item: ${item.id}`);
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
    next() {
      if (!state.queue.length) return null;
      if (state.repeat === 'one') return state.current;
      if (state.queueIndex < state.queue.length - 1) {
        const nextIndex = state.queueIndex + 1;
        publish({ ...state, queueIndex: nextIndex, current: state.queue[nextIndex] });
        return state.queue[nextIndex];
      }
      if (state.repeat === 'all') {
        publish({ ...state, queueIndex: 0, current: state.queue[0] });
        return state.queue[0];
      }
      return null;
    },
    previous() {
      if (!state.queue.length) return null;
      if (state.repeat === 'one') return state.current;
      if (state.queueIndex > 0) {
        const previousIndex = state.queueIndex - 1;
        publish({ ...state, queueIndex: previousIndex, current: state.queue[previousIndex] });
        return state.queue[previousIndex];
      }
      if (state.repeat === 'all') {
        const previousIndex = state.queue.length - 1;
        publish({ ...state, queueIndex: previousIndex, current: state.queue[previousIndex] });
        return state.queue[previousIndex];
      }
      return null;
    },
    reset() { publish(cloneState(INITIAL_STATE)); },
  };
}

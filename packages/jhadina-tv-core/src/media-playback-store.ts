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

function buildShuffleOrder(items: readonly MediaQueueItem[], currentId: string | null): string[] {
  const ids = items.map((item) => item.id);
  const current = currentId && ids.includes(currentId) ? currentId : null;
  const rest = ids.filter((id) => id !== current);
  for (let i = rest.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return current ? [current, ...rest] : rest;
}

export function createMediaPlaybackStore(initial: Partial<MediaPlaybackStoreState> = {}): MediaPlaybackStore {
  assertUniqueQueueIds(initial.queue ?? []);
  let state: MediaPlaybackStoreState = { ...INITIAL_STATE, ...initial, queue: [...(initial.queue ?? [])] };
  let shuffleOrder = state.shuffle ? buildShuffleOrder(state.queue, state.current?.id ?? null) : state.queue.map((item) => item.id);
  let shufflePosition = state.shuffle && state.current ? Math.max(0, shuffleOrder.indexOf(state.current.id)) : Math.max(0, state.queueIndex);
  const listeners = new Set<(next: MediaPlaybackStoreState) => void>();
  const publish = (next: MediaPlaybackStoreState) => {
    state = next;
    const snapshot = cloneState(state);
    listeners.forEach((listener) => listener(snapshot));
  };
  const currentId = () => state.current?.id ?? null;
  const syncShuffleOrder = () => {
    const ids = new Set(state.queue.map((item) => item.id));
    shuffleOrder = shuffleOrder.filter((id) => ids.has(id));
    const missing = state.queue.map((item) => item.id).filter((id) => !shuffleOrder.includes(id));
    shuffleOrder.push(...missing);
    const id = currentId();
    shufflePosition = id ? Math.max(0, shuffleOrder.indexOf(id)) : -1;
  };
  const move = (direction: 1 | -1): MediaQueueItem | null => {
    if (!state.queue.length || !state.current) return null;
    if (state.repeat === 'one') return state.current;
    if (!state.shuffle) {
      const nextIndex = state.queueIndex + direction;
      if (nextIndex >= 0 && nextIndex < state.queue.length) {
        const next = state.queue[nextIndex];
        publish({ ...state, queueIndex: nextIndex, current: next });
        return next;
      }
      if (state.repeat === 'all') {
        const wrapIndex = direction > 0 ? 0 : state.queue.length - 1;
        const next = state.queue[wrapIndex];
        publish({ ...state, queueIndex: wrapIndex, current: next });
        return next;
      }
      return null;
    }
    syncShuffleOrder();
    const nextPosition = shufflePosition + direction;
    if (nextPosition >= 0 && nextPosition < shuffleOrder.length) {
      shufflePosition = nextPosition;
      const nextIndex = state.queue.findIndex((item) => item.id === shuffleOrder[nextPosition]);
      const next = state.queue[nextIndex];
      publish({ ...state, queueIndex: nextIndex, current: next });
      return next;
    }
    if (state.repeat === 'all') {
      shuffleOrder = buildShuffleOrder(state.queue, state.current.id);
      shufflePosition = direction > 0 ? 0 : shuffleOrder.length - 1;
      const nextIndex = state.queue.findIndex((item) => item.id === shuffleOrder[shufflePosition]);
      const next = state.queue[nextIndex];
      publish({ ...state, queueIndex: nextIndex, current: next });
      return next;
    }
    return null;
  };

  return {
    getState: () => cloneState(state),
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    setCurrent(item, queueIndex = item ? Math.max(0, queueIndex) : -1) {
      if (!item) { publish({ ...state, current: null, queueIndex: -1 }); shufflePosition = -1; return; }
      const existingIndex = state.queue.findIndex((entry) => entry.id === item.id);
      if (existingIndex >= 0) {
        const nextIndex = Math.min(Math.max(0, queueIndex), state.queue.length - 1);
        if (state.queue[nextIndex]?.id !== item.id) throw new Error('Current media queue item does not match queue index.');
        publish({ ...state, current: state.queue[nextIndex], queueIndex: nextIndex });
        if (state.shuffle) { syncShuffleOrder(); }
        return;
      }
      if (state.queue.length) throw new Error('Current media queue item must belong to the queue.');
      publish({ ...state, current: item, queueIndex: 0 });
      shuffleOrder = [item.id];
      shufflePosition = 0;
    },
    setQueue(items, queueIndex = items.length ? 0 : -1) {
      assertUniqueQueueIds(items);
      const nextQueue = [...items];
      const nextIndex = nextQueue.length ? Math.min(Math.max(0, queueIndex), nextQueue.length - 1) : -1;
      const nextCurrent = nextIndex >= 0 ? nextQueue[nextIndex] : null;
      publish({ ...state, queue: nextQueue, queueIndex: nextIndex, current: nextCurrent });
      shuffleOrder = state.shuffle ? buildShuffleOrder(nextQueue, nextCurrent?.id ?? null) : nextQueue.map((item) => item.id);
      shufflePosition = nextCurrent ? Math.max(0, shuffleOrder.indexOf(nextCurrent.id)) : -1;
    },
    addToQueue(item) {
      if (!item.id) throw new Error('Media queue item identity is required.');
      if (state.queue.some((entry) => entry.id === item.id)) throw new Error(`Duplicate media queue item: ${item.id}`);
      publish({ ...state, queue: [...state.queue, item] });
      shuffleOrder = [...shuffleOrder.filter((id) => id !== item.id), item.id];
    },
    removeFromQueue(itemId) {
      const removedIndex = state.queue.findIndex((item) => item.id === itemId);
      if (removedIndex < 0) return;
      const wasCurrent = state.current?.id === itemId;
      const nextQueue = state.queue.filter((item) => item.id !== itemId);
      let nextIndex = state.queueIndex;
      if (!nextQueue.length) nextIndex = -1;
      else if (removedIndex < state.queueIndex) nextIndex = state.queueIndex - 1;
      else if (removedIndex === state.queueIndex) nextIndex = Math.min(state.queueIndex, nextQueue.length - 1);
      publish({ ...state, queue: nextQueue, queueIndex: nextIndex, current: nextIndex >= 0 ? nextQueue[nextIndex] : null });
      shuffleOrder = shuffleOrder.filter((id) => id !== itemId);
      if (wasCurrent && nextQueue.length && state.shuffle) {
        shufflePosition = Math.max(0, shuffleOrder.indexOf(state.current!.id));
      } else {
        shufflePosition = state.current ? Math.max(0, shuffleOrder.indexOf(state.current.id)) : -1;
      }
    },
    clearQueue() { publish({ ...state, queue: [], queueIndex: -1, current: null }); shuffleOrder = []; shufflePosition = -1; },
    updatePlayerState(playerState) { publish({ ...state, playerState }); },
    setRepeat(repeat) { publish({ ...state, repeat }); },
    setShuffle(shuffle) {
      if (shuffle === state.shuffle) return;
      if (shuffle) {
        shuffleOrder = buildShuffleOrder(state.queue, state.current?.id ?? null);
        shufflePosition = state.current ? Math.max(0, shuffleOrder.indexOf(state.current.id)) : -1;
      } else {
        shuffleOrder = state.queue.map((item) => item.id);
        shufflePosition = state.current ? Math.max(0, state.queue.findIndex((item) => item.id === state.current!.id)) : -1;
      }
      publish({ ...state, shuffle });
    },
    next: () => move(1),
    previous: () => move(-1),
    reset() { publish(cloneState(INITIAL_STATE)); shuffleOrder = []; shufflePosition = -1; },
  };
}

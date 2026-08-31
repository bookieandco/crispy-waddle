import type { MediaItem, MediaSessionSnapshot, PlaybackTarget } from './media-domain';
import type { UnifiedMediaSession } from './media-session';

export interface MediaPlayerStore {
  getState(): MediaSessionSnapshot;
  subscribe(listener: (state: MediaSessionSnapshot) => void): () => void;
  attachSession(session: UnifiedMediaSession): () => void;
  load(item: MediaItem): void;
  setQueue(items: MediaItem[], currentIndex?: number): void;
  enqueue(item: MediaItem): void;
  removeFromQueue(index: number): void;
  clearQueue(): void;
  play(): Promise<void>;
  pause(): Promise<void>;
  seek(positionSeconds: number): Promise<void>;
  setVolume(value: number): Promise<void>;
  discoverTargets(): Promise<PlaybackTarget[]>;
  transfer(target: PlaybackTarget): Promise<void>;
  disconnect(): Promise<void>;
}

const emptyQueue = () => ({ items: [], currentIndex: -1, shuffle: false, repeat: 'off' as const });

export function createMediaPlayerStore(initial?: Partial<MediaSessionSnapshot>): MediaPlayerStore {
  let state: MediaSessionSnapshot = { queue: emptyQueue(), playback: { status: 'idle', positionMs: 0, volume: 1, rate: 1, muted: false }, ...initial };
  let session: UnifiedMediaSession | undefined;
  let unsubscribeSession: (() => void) | undefined;
  const listeners = new Set<(next: MediaSessionSnapshot) => void>();
  const publish = (next: MediaSessionSnapshot) => { state = next; listeners.forEach((listener) => listener(state)); };
  const requireSession = () => { if (!session) throw new Error('No media session is attached.'); return session; };
  return {
    getState: () => state,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    attachSession(nextSession) { unsubscribeSession?.(); session = nextSession; publish(nextSession.getState()); unsubscribeSession = nextSession.subscribe(publish); return () => { if (session === nextSession) { unsubscribeSession?.(); unsubscribeSession = undefined; session = undefined; } }; },
    load(item) { const items = state.queue.items.some((candidate) => candidate.id === item.id && candidate.providerId === item.providerId) ? state.queue.items : [...state.queue.items, item]; publish({ ...state, item, queue: { ...state.queue, items, currentIndex: Math.max(0, items.findIndex((candidate) => candidate.id === item.id && candidate.providerId === item.providerId)) }, playback: { ...state.playback, status: 'loading', positionMs: 0, durationMs: item.durationMs, error: undefined, updatedAt: Date.now() } }); },
    setQueue(items, currentIndex = items.length ? 0 : -1) { publish({ ...state, queue: { ...state.queue, items, currentIndex }, item: items[currentIndex], playback: { ...state.playback, status: items[currentIndex] ? 'ready' : 'idle', positionMs: 0, durationMs: items[currentIndex]?.durationMs, updatedAt: Date.now() } }); },
    enqueue(item) { publish({ ...state, queue: { ...state.queue, items: [...state.queue.items, item], currentIndex: state.queue.currentIndex < 0 ? 0 : state.queue.currentIndex } }); },
    removeFromQueue(index) { const items = state.queue.items.filter((_, candidateIndex) => candidateIndex !== index); let currentIndex = state.queue.currentIndex; if (index < currentIndex) currentIndex -= 1; if (index === currentIndex) currentIndex = Math.min(currentIndex, items.length - 1); publish({ ...state, queue: { ...state.queue, items, currentIndex } }); },
    clearQueue() { publish({ ...state, queue: { ...state.queue, items: state.item ? [state.item] : [], currentIndex: state.item ? 0 : -1 } }); },
    play: () => requireSession().play(),
    pause: () => requireSession().pause(),
    seek: (position) => requireSession().seek(Math.max(0, position)),
    setVolume: (value) => requireSession().setVolume(Math.max(0, Math.min(1, value))),
    discoverTargets: () => requireSession().discoverTargets(),
    transfer: (target) => requireSession().transfer(target),
    disconnect: () => requireSession().disconnect(),
  };
}

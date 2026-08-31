import type { MediaItem, MediaSessionSnapshot, PlaybackTarget } from './media-domain';
import type { UnifiedMediaSession } from './media-session';
import type { MediaPlaybackProgress, MediaPlaybackProgressRepository } from './media-playback-persistence';

export type MediaRepeatMode = MediaSessionSnapshot['queue']['repeat'];

export interface MediaPlayerStore {
  getState(): MediaSessionSnapshot;
  subscribe(listener: (state: MediaSessionSnapshot) => void): () => void;
  attachSession(session: UnifiedMediaSession): () => void;
  load(item: MediaItem): void;
  restore(item: MediaItem): Promise<MediaPlaybackProgress | null>;
  persistProgress(): Promise<MediaPlaybackProgress | null>;
  setQueue(items: MediaItem[], currentIndex?: number): void;
  enqueue(item: MediaItem): void;
  removeFromQueue(index: number): void;
  clearQueue(): void;
  playAt(index: number): Promise<void>;
  next(): Promise<void>;
  previous(): Promise<void>;
  setShuffle(enabled: boolean): void;
  setRepeat(mode: MediaRepeatMode): void;
  play(): Promise<void>;
  pause(): Promise<void>;
  seek(positionSeconds: number): Promise<void>;
  setVolume(value: number): Promise<void>;
  discoverTargets(): Promise<PlaybackTarget[]>;
  transfer(target: PlaybackTarget): Promise<void>;
  disconnect(): Promise<void>;
}

export interface MediaPlayerStoreOptions {
  userId?: string;
  persistence?: MediaPlaybackProgressRepository;
  resumeThresholdMs?: number;
  completionThreshold?: number;
}

const emptyQueue = () => ({ items: [], currentIndex: -1, shuffle: false, repeat: 'off' as const });
const clampIndex = (index: number, length: number) => length === 0 ? -1 : Math.max(0, Math.min(index, length - 1));

export function createMediaPlayerStore(initial?: Partial<MediaSessionSnapshot>, options: MediaPlayerStoreOptions = {}): MediaPlayerStore {
  let state: MediaSessionSnapshot = { queue: emptyQueue(), playback: { status: 'idle', positionMs: 0, volume: 1, rate: 1, muted: false }, ...initial };
  let session: UnifiedMediaSession | undefined;
  let unsubscribeSession: (() => void) | undefined;
  let persistTimer: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<(next: MediaSessionSnapshot) => void>();
  const publish = (next: MediaSessionSnapshot) => { state = next; listeners.forEach((listener) => listener(state)); schedulePersist(); };
  const requireSession = () => { if (!session) throw new Error('No media session is attached.'); return session; };
  const currentKey = () => state.item ? { providerId: state.item.providerId, itemId: state.item.id } : null;
  const schedulePersist = () => { if (!options.persistence || !options.userId || !state.item) return; if (persistTimer) clearTimeout(persistTimer); persistTimer = setTimeout(() => { void persistProgress(); }, 1000); };
  const select = (index: number) => { const item = state.queue.items[index]; if (!item) return false; publish({ ...state, item, queue: { ...state.queue, currentIndex: index }, playback: { ...state.playback, status: 'ready', positionMs: 0, durationMs: item.durationMs, error: undefined, updatedAt: Date.now() } }); return true; };
  const completionThreshold = options.completionThreshold ?? 0.95;
  const toProgress = (): MediaPlaybackProgress | null => { const key = currentKey(); if (!key || !options.userId) return null; const duration = state.playback.durationMs ?? state.item?.durationMs; const completed = state.playback.status === 'ended' || Boolean(duration && duration > 0 && state.playback.positionMs / duration >= completionThreshold); return { userId: options.userId, providerId: key.providerId, itemId: key.itemId, positionMs: Math.max(0, state.playback.positionMs), durationMs: duration, completed, updatedAt: new Date().toISOString() }; };
  return {
    getState: () => state,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    attachSession(nextSession) { unsubscribeSession?.(); session = nextSession; publish(nextSession.getState()); unsubscribeSession = nextSession.subscribe(publish); return () => { if (session === nextSession) { unsubscribeSession?.(); unsubscribeSession = undefined; session = undefined; } }; },
    load(item) { const existingIndex = state.queue.items.findIndex((candidate) => candidate.id === item.id && candidate.providerId === item.providerId); const items = existingIndex >= 0 ? state.queue.items : [...state.queue.items, item]; const index = existingIndex >= 0 ? existingIndex : items.length - 1; publish({ ...state, item, queue: { ...state.queue, items, currentIndex: index }, playback: { ...state.playback, status: 'loading', positionMs: 0, durationMs: item.durationMs, error: undefined, updatedAt: Date.now() } }); },
    async restore(item) { if (!options.persistence || !options.userId) return null; const progress = await options.persistence.get(options.userId, item.providerId, item.id); if (!progress || progress.completed || progress.positionMs < (options.resumeThresholdMs ?? 5000)) return progress; const existingIndex = state.queue.items.findIndex((candidate) => candidate.id === item.id && candidate.providerId === item.providerId); const items = existingIndex >= 0 ? state.queue.items : [...state.queue.items, item]; const index = existingIndex >= 0 ? existingIndex : items.length - 1; publish({ ...state, item, queue: { ...state.queue, items, currentIndex: index }, playback: { ...state.playback, positionMs: progress.positionMs, durationMs: progress.durationMs ?? item.durationMs, status: 'paused', error: undefined, updatedAt: Date.now() } }); return progress; },
    async persistProgress() { if (persistTimer) { clearTimeout(persistTimer); persistTimer = undefined; } const progress = toProgress(); if (!progress || !options.persistence) return null; return options.persistence.upsert(progress); },
    setQueue(items, currentIndex = items.length ? 0 : -1) { const index = clampIndex(currentIndex, items.length); publish({ ...state, item: items[index], queue: { ...state.queue, items, currentIndex: index }, playback: { ...state.playback, status: items[index] ? 'ready' : 'idle', positionMs: 0, durationMs: items[index]?.durationMs, updatedAt: Date.now() } }); },
    enqueue(item) { publish({ ...state, queue: { ...state.queue, items: [...state.queue.items, item], currentIndex: state.queue.currentIndex < 0 ? 0 : state.queue.currentIndex } }); },
    removeFromQueue(index) { if (index < 0 || index >= state.queue.items.length) return; const items = state.queue.items.filter((_, candidateIndex) => candidateIndex !== index); let currentIndex = state.queue.currentIndex; if (index < currentIndex) currentIndex -= 1; else if (index === currentIndex) currentIndex = Math.min(currentIndex, items.length - 1); publish({ ...state, item: items[currentIndex], queue: { ...state.queue, items, currentIndex } }); },
    clearQueue() { const item = state.item; publish({ ...state, queue: { ...state.queue, items: item ? [item] : [], currentIndex: item ? 0 : -1 } }); },
    async playAt(index) { if (!select(clampIndex(index, state.queue.items.length))) return; await requireSession().play(); },
    async next() { const { items, currentIndex, repeat, shuffle } = state.queue; if (!items.length) return; if (repeat === 'one') { await requireSession().seek(0); await requireSession().play(); return; } let nextIndex: number; if (shuffle && items.length > 1) { const candidates = items.map((_, candidateIndex) => candidateIndex).filter((candidateIndex) => candidateIndex !== currentIndex); nextIndex = candidates[Math.floor(Math.random() * candidates.length)]; } else { nextIndex = currentIndex + 1; if (nextIndex >= items.length) { if (repeat !== 'all') { publish({ ...state, playback: { ...state.playback, status: 'ended', updatedAt: Date.now() } }); return; } nextIndex = 0; } } await this.playAt(nextIndex); },
    async previous() { const { items, currentIndex } = state.queue; if (!items.length) return; if (state.playback.positionMs > 3000) { await requireSession().seek(0); return; } const previousIndex = currentIndex <= 0 ? (state.queue.repeat === 'all' ? items.length - 1 : 0) : currentIndex - 1; await this.playAt(previousIndex); },
    setShuffle(enabled) { publish({ ...state, queue: { ...state.queue, shuffle: enabled } }); },
    setRepeat(mode) { publish({ ...state, queue: { ...state.queue, repeat: mode } }); },
    play: () => requireSession().play(),
    pause: async () => { await requireSession().pause(); await this.persistProgress(); },
    seek: async (position) => { await requireSession().seek(Math.max(0, position)); await this.persistProgress(); },
    setVolume: (value) => requireSession().setVolume(Math.max(0, Math.min(1, value))),
    discoverTargets: () => requireSession().discoverTargets(),
    transfer: async (target) => { await requireSession().transfer(target); await this.persistProgress(); },
    disconnect: async () => { await requireSession().disconnect(); await this.persistProgress(); },
  };
}

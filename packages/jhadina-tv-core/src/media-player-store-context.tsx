'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { MediaItem, MediaSessionSnapshot, PlaybackTarget } from './media-domain';
import type { UnifiedMediaSession } from './media-session';
import { createMediaPlayerStore, type MediaPlayerStore } from './media-player-store';

const MediaPlayerStoreContext = createContext<MediaPlayerStore | null>(null);

export function MediaPlayerStoreProvider({ children, store }: { children: ReactNode; store?: MediaPlayerStore }) {
  const storeRef = useRef<MediaPlayerStore>(store ?? createMediaPlayerStore());
  return <MediaPlayerStoreContext.Provider value={storeRef.current}>{children}</MediaPlayerStoreContext.Provider>;
}

export function useMediaPlayerStore(): MediaPlayerStore {
  const store = useContext(MediaPlayerStoreContext);
  if (!store) throw new Error('useMediaPlayerStore must be used inside MediaPlayerStoreProvider.');
  return store;
}

export function useMediaPlayerState(): MediaSessionSnapshot {
  const store = useMediaPlayerStore();
  const [state, setState] = useState(store.getState());
  useEffect(() => store.subscribe(setState), [store]);
  return state;
}

export function useMediaPlayerSession(session: UnifiedMediaSession | null): MediaPlayerStore {
  const store = useMediaPlayerStore();
  useEffect(() => session ? store.attachSession(session) : undefined, [store, session]);
  return store;
}

export type MediaPlayerActions = Pick<MediaPlayerStore, 'play' | 'pause' | 'next' | 'previous' | 'seek' | 'setVolume' | 'playAt' | 'enqueue' | 'removeFromQueue' | 'setShuffle' | 'setRepeat' | 'discoverTargets' | 'transfer' | 'disconnect'>;
export type MediaPlayerViewState = Pick<MediaSessionSnapshot, 'item' | 'queue' | 'playback' | 'target' | 'capabilities' | 'captions' | 'audioTrack'>;

export function selectMediaPlayerState(state: MediaSessionSnapshot): MediaPlayerViewState { return { item: state.item, queue: state.queue, playback: state.playback, target: state.target, capabilities: state.capabilities, captions: state.captions, audioTrack: state.audioTrack }; }

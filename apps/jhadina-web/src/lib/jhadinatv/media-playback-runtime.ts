import type { MediaPlaybackStore, MediaQueueItem, UnifiedMediaSession, UnifiedMediaSessionConfig } from '@jhadina/tv-core';
import { createMediaPlaybackStore, createUnifiedMediaSession } from '@jhadina/tv-core';

const MEDIA_ELEMENT_ATTRIBUTE = 'data-jhadina-media-element';

export interface MediaPlaybackSnapshot {
  session: UnifiedMediaSession | null;
  current: MediaQueueItem | null;
  playerState: ReturnType<UnifiedMediaSession['getState']>;
}

type MediaPlaybackSnapshotListener = (snapshot: MediaPlaybackSnapshot) => void;

let store: MediaPlaybackStore | null = null;
let session: UnifiedMediaSession | null = null;
let unsubscribeSession: (() => void) | null = null;
let persistentMediaElement: HTMLVideoElement | null = null;
let sessionGeneration = 0;
const snapshotListeners = new Set<MediaPlaybackSnapshotListener>();

function snapshot(): MediaPlaybackSnapshot {
  const state = getMediaPlaybackStore().getState();
  return { session, current: state.current, playerState: state.playerState };
}

function publishSnapshot(): void {
  const next = snapshot();
  for (const listener of snapshotListeners) listener(next);
}

export function getMediaPlaybackStore(): MediaPlaybackStore {
  if (!store) store = createMediaPlaybackStore();
  return store;
}

export function getMediaPlaybackSnapshot(): MediaPlaybackSnapshot { return snapshot(); }

export function subscribeMediaPlaybackSnapshot(listener: MediaPlaybackSnapshotListener): () => void {
  snapshotListeners.add(listener);
  listener(snapshot());
  return () => snapshotListeners.delete(listener);
}

export function getMediaPlaybackSession(): UnifiedMediaSession | null { return session; }

export function getPersistentMediaElement(): HTMLVideoElement {
  if (typeof document === 'undefined') throw new Error('JHADINA_MEDIA_ELEMENT_UNAVAILABLE_ON_SERVER');
  if (!persistentMediaElement || !persistentMediaElement.isConnected) {
    const existing = document.querySelector<HTMLVideoElement>(`video[${MEDIA_ELEMENT_ATTRIBUTE}]`);
    persistentMediaElement = existing ?? document.createElement('video');
    persistentMediaElement.setAttribute(MEDIA_ELEMENT_ATTRIBUTE, 'true');
    persistentMediaElement.playsInline = true;
    persistentMediaElement.controls = true;
  }
  if (!persistentMediaElement.isConnected) document.body.appendChild(persistentMediaElement);
  return persistentMediaElement;
}

export function mountPersistentMediaElement(host: HTMLElement): HTMLVideoElement {
  const video = getPersistentMediaElement();
  if (video.parentElement !== host) host.appendChild(video);
  video.style.display = '';
  return video;
}

export function releasePersistentMediaElement(host?: HTMLElement): void {
  if (!persistentMediaElement) return;
  if (host && persistentMediaElement.parentElement !== host) return;
  if (persistentMediaElement.parentElement !== document.body) document.body.appendChild(persistentMediaElement);
  persistentMediaElement.style.display = 'none';
}

function observeSession(nextSession: UnifiedMediaSession): void {
  const generation = ++sessionGeneration;
  unsubscribeSession?.();
  unsubscribeSession = nextSession.subscribe((state) => {
    if (generation !== sessionGeneration || session !== nextSession) return;
    getMediaPlaybackStore().updatePlayerState(state);
    publishSnapshot();
  });
  getMediaPlaybackStore().updatePlayerState(nextSession.getState());
  publishSnapshot();
}

/**
 * The runtime is the sole owner of the playback session. Routes provide a
 * session configuration only when no shared session exists; later routes
 * reuse the same session and load playback through its public command API.
 */
export async function ensureMediaPlaybackSession(config: UnifiedMediaSessionConfig, item: MediaQueueItem): Promise<UnifiedMediaSession> {
  if (!session) {
    session = createUnifiedMediaSession(config);
    const playbackStore = getMediaPlaybackStore();
    const currentIndex = playbackStore.getState().queue.findIndex((entry) => entry.id === item.id);
    if (currentIndex >= 0) playbackStore.setCurrent(item, currentIndex);
    else if (playbackStore.getState().queue.length === 0) playbackStore.setCurrent(item, 0);
    else {
      playbackStore.addToQueue(item);
      const nextIndex = playbackStore.getState().queue.findIndex((entry) => entry.id === item.id);
      playbackStore.setCurrent(item, nextIndex);
    }
    observeSession(session);
    return session;
  }

  const sharedSession = session;
  const current = getMediaPlaybackStore().getState().current;
  if (!current || current.id !== item.id) {
    await sharedSession.loadPlayback(item.playback);
    const playbackStore = getMediaPlaybackStore();
    const currentIndex = playbackStore.getState().queue.findIndex((entry) => entry.id === item.id);
    if (currentIndex >= 0) playbackStore.setCurrent(item, currentIndex);
    else {
      playbackStore.addToQueue(item);
      const nextIndex = playbackStore.getState().queue.findIndex((entry) => entry.id === item.id);
      playbackStore.setCurrent(item, nextIndex);
    }
    publishSnapshot();
  }
  return sharedSession;
}

/** Observer-only release for route/view unmounts. Playback continues. */
export function releaseMediaPlaybackView(): void {
  unsubscribeSession?.();
  unsubscribeSession = null;
  publishSnapshot();
}

/** Explicit destructive shutdown. */
export function disposeMediaPlaybackSession(): void {
  sessionGeneration += 1;
  unsubscribeSession?.();
  unsubscribeSession = null;
  const currentSession = session;
  session = null;
  currentSession?.dispose();
  publishSnapshot();
}

/** @deprecated Use releaseMediaPlaybackView() or disposeMediaPlaybackSession(). */
export function detachMediaPlaybackSession(): void {
  releaseMediaPlaybackView();
}

/** @deprecated Direct attachment is retained only for compatibility. New routes should use ensureMediaPlaybackSession(). */
export function attachMediaPlaybackSession(nextSession: UnifiedMediaSession, item: MediaQueueItem): void {
  if (session && session !== nextSession) throw new Error('JHADINA_MEDIA_PLAYBACK_SESSION_ALREADY_OWNED');
  session = nextSession;
  const playbackStore = getMediaPlaybackStore();
  const currentIndex = playbackStore.getState().queue.findIndex((entry) => entry.id === item.id);
  if (currentIndex >= 0) playbackStore.setCurrent(item, currentIndex);
  else if (playbackStore.getState().queue.length === 0) playbackStore.setCurrent(item, 0);
  else {
    playbackStore.addToQueue(item);
    const nextIndex = playbackStore.getState().queue.findIndex((entry) => entry.id === item.id);
    playbackStore.setCurrent(item, nextIndex);
  }
  observeSession(nextSession);
}

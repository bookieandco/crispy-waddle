import type { MediaPlaybackStore, MediaQueueItem, UnifiedMediaSession } from '@jhadina/tv-core';
import { createMediaPlaybackStore } from '@jhadina/tv-core';

const MEDIA_ELEMENT_ATTRIBUTE = 'data-jhadina-media-element';

let store: MediaPlaybackStore | null = null;
let session: UnifiedMediaSession | null = null;
let unsubscribeSession: (() => void) | null = null;
let persistentMediaElement: HTMLVideoElement | null = null;

export function getMediaPlaybackStore(): MediaPlaybackStore {
  if (!store) store = createMediaPlaybackStore();
  return store;
}

export function getMediaPlaybackSession(): UnifiedMediaSession | null {
  return session;
}

export function getPersistentMediaElement(): HTMLVideoElement {
  if (typeof document === 'undefined') {
    throw new Error('JHADINA_MEDIA_ELEMENT_UNAVAILABLE_ON_SERVER');
  }

  if (!persistentMediaElement || !persistentMediaElement.isConnected) {
    const existing = document.querySelector<HTMLVideoElement>(`video[${MEDIA_ELEMENT_ATTRIBUTE}]`);
    persistentMediaElement = existing ?? document.createElement('video');
    persistentMediaElement.setAttribute(MEDIA_ELEMENT_ATTRIBUTE, 'true');
    persistentMediaElement.playsInline = true;
    persistentMediaElement.controls = true;
  }

  if (!persistentMediaElement.isConnected) {
    document.body.appendChild(persistentMediaElement);
  }

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
  if (persistentMediaElement.parentElement !== document.body) {
    document.body.appendChild(persistentMediaElement);
  }
  persistentMediaElement.style.display = 'none';
}

export function attachMediaPlaybackSession(nextSession: UnifiedMediaSession, item: MediaQueueItem): void {
  if (session === nextSession) return;
  detachMediaPlaybackSession();
  session = nextSession;
  const playbackStore = getMediaPlaybackStore();
  playbackStore.setCurrent(item, 0);
  unsubscribeSession = nextSession.subscribe((state) => playbackStore.updatePlayerState(state));
  playbackStore.updatePlayerState(nextSession.getState());
}

/**
 * Release the current route's subscription without disposing the shared session.
 * The persistent media element and session may continue playing across navigation.
 */
export function releaseMediaPlaybackSessionSubscription(unsubscribe?: () => void): void {
  unsubscribe?.();
}

/**
 * Explicitly stop the shared playback session. Route unmounts should not call this.
 */
export function detachMediaPlaybackSession(): void {
  unsubscribeSession?.();
  unsubscribeSession = null;
  session?.dispose();
  session = null;
}

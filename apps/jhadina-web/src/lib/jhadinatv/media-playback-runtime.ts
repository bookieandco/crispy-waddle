import type { MediaPlaybackStore, MediaQueueItem, UnifiedMediaSession, UnifiedMediaSessionConfig } from '@jhadina/tv-core';
import { createMediaPlaybackStore, createUnifiedMediaSession } from '@jhadina/tv-core';
import { attachRuntimeProgressPersistence, createMediaPlaybackProgressApiClient, type RuntimeProgressClient, type RuntimeProgressPersistence } from './media-playback-progress-runtime';

const MEDIA_ELEMENT_ATTRIBUTE = 'data-jhadina-media-element';
export interface MediaPlaybackSnapshot { session: UnifiedMediaSession | null; current: MediaQueueItem | null; playerState: ReturnType<UnifiedMediaSession['getState']>; }
type MediaPlaybackSnapshotListener = (snapshot: MediaPlaybackSnapshot) => void;
export interface MediaPlaybackProgressPersistenceConfig { userId: string; client?: RuntimeProgressClient; throttleMs?: number; onError?: (error: unknown) => void; }
export interface MediaPlaybackLoadRequest { readonly cancelled: boolean; cancel(): void; }

let store: MediaPlaybackStore | null = null;
let session: UnifiedMediaSession | null = null;
let sessionInitialization: Promise<UnifiedMediaSession> | null = null;
let sessionCommand: Promise<void> = Promise.resolve();
let sessionCommandGeneration = 0;
let latestLoadRequestGeneration = 0;
let unsubscribeSession: (() => void) | null = null;
let progressPersistence: RuntimeProgressPersistence | null = null;
let progressPersistenceConfig: MediaPlaybackProgressPersistenceConfig | null = null;
let persistentMediaElement: HTMLVideoElement | null = null;
let sessionGeneration = 0;
const snapshotListeners = new Set<MediaPlaybackSnapshotListener>();

function snapshot(): MediaPlaybackSnapshot { const state = getMediaPlaybackStore().getState(); return { session, current: state.current, playerState: state.playerState }; }
function publishSnapshot(): void { const next = snapshot(); for (const listener of snapshotListeners) listener(next); }
export function getMediaPlaybackStore(): MediaPlaybackStore { if (!store) store = createMediaPlaybackStore(); return store; }
export function getMediaPlaybackSnapshot(): MediaPlaybackSnapshot { return snapshot(); }
export function subscribeMediaPlaybackSnapshot(listener: MediaPlaybackSnapshotListener): () => void { snapshotListeners.add(listener); listener(snapshot()); return () => snapshotListeners.delete(listener); }
export function getMediaPlaybackSession(): UnifiedMediaSession | null { return session; }

export function getPersistentMediaElement(): HTMLVideoElement {
  if (typeof document === 'undefined') throw new Error('JHADINA_MEDIA_ELEMENT_UNAVAILABLE_ON_SERVER');
  if (!persistentMediaElement || !persistentMediaElement.isConnected) { const existing = document.querySelector<HTMLVideoElement>(`video[${MEDIA_ELEMENT_ATTRIBUTE}]`); persistentMediaElement = existing ?? document.createElement('video'); persistentMediaElement.setAttribute(MEDIA_ELEMENT_ATTRIBUTE, 'true'); persistentMediaElement.playsInline = true; persistentMediaElement.controls = true; }
  if (!persistentMediaElement.isConnected) document.body.appendChild(persistentMediaElement); return persistentMediaElement;
}
export function mountPersistentMediaElement(host: HTMLElement): HTMLVideoElement { const video = getPersistentMediaElement(); if (video.parentElement !== host) host.appendChild(video); video.style.display = ''; return video; }
export function releasePersistentMediaElement(host?: HTMLElement): void { if (!persistentMediaElement) return; if (host && persistentMediaElement.parentElement !== host) return; if (persistentMediaElement.parentElement !== document.body) document.body.appendChild(persistentMediaElement); persistentMediaElement.style.display = 'none'; }

function attachConfiguredProgressPersistence(nextSession: UnifiedMediaSession): void { progressPersistence?.dispose(); progressPersistence = null; const config = progressPersistenceConfig; if (!config) return; progressPersistence = attachRuntimeProgressPersistence({ session: nextSession, getCurrentItem: () => getMediaPlaybackStore().getState().current, userId: config.userId, client: config.client ?? createMediaPlaybackProgressApiClient(), throttleMs: config.throttleMs, onError: config.onError }); }
export function configureMediaPlaybackProgressPersistence(config: MediaPlaybackProgressPersistenceConfig): RuntimeProgressPersistence | null { if (!config.userId.trim()) throw new Error('JHADINA_MEDIA_PLAYBACK_PROGRESS_USER_REQUIRED'); progressPersistenceConfig = config; if (!session) return null; attachConfiguredProgressPersistence(session); return progressPersistence; }
export async function flushMediaPlaybackProgress(completed = false): Promise<void> { await progressPersistence?.flush(completed); }

function observeSession(nextSession: UnifiedMediaSession): void { const generation = ++sessionGeneration; unsubscribeSession?.(); unsubscribeSession = nextSession.subscribe((state) => { if (generation !== sessionGeneration || session !== nextSession) return; getMediaPlaybackStore().updatePlayerState(state); publishSnapshot(); }); getMediaPlaybackStore().updatePlayerState(nextSession.getState()); attachConfiguredProgressPersistence(nextSession); publishSnapshot(); }
function queueItem(item: MediaQueueItem): void { const playbackStore = getMediaPlaybackStore(); const currentState = playbackStore.getState(); const existingIndex = currentState.queue.findIndex((entry) => entry.id === item.id); if (existingIndex >= 0) playbackStore.setCurrent(item, existingIndex); else if (currentState.queue.length === 0) playbackStore.setCurrent(item, 0); else { playbackStore.addToQueue(item); const nextIndex = playbackStore.getState().queue.findIndex((entry) => entry.id === item.id); playbackStore.setCurrent(item, nextIndex); } }

function createLoadRequest(): { request: MediaPlaybackLoadRequest; generation: number } {
  const generation = ++latestLoadRequestGeneration;
  let cancelled = false;
  const request = { get cancelled() { return cancelled; }, cancel() { cancelled = true; } } as MediaPlaybackLoadRequest;
  return { request, generation };
}
function assertLoadRequestCurrent(request: MediaPlaybackLoadRequest, generation: number): void {
  if (request.cancelled || generation !== latestLoadRequestGeneration) throw new Error('JHADINA_MEDIA_PLAYBACK_LOAD_CANCELLED');
}
function enqueueSessionCommand<T>(operation: () => Promise<T>, request: MediaPlaybackLoadRequest, requestGeneration: number): Promise<T> {
  const generation = sessionCommandGeneration;
  const run = sessionCommand.then(async () => { assertLoadRequestCurrent(request, requestGeneration); if (generation !== sessionCommandGeneration) throw new Error('JHADINA_MEDIA_PLAYBACK_COMMAND_CANCELLED'); return operation(); }, async () => { assertLoadRequestCurrent(request, requestGeneration); if (generation !== sessionCommandGeneration) throw new Error('JHADINA_MEDIA_PLAYBACK_COMMAND_CANCELLED'); return operation(); });
  sessionCommand = run.then(() => undefined, () => undefined);
  return run;
}

export async function ensureMediaPlaybackSession(config: UnifiedMediaSessionConfig, item: MediaQueueItem, request?: MediaPlaybackLoadRequest): Promise<UnifiedMediaSession> {
  const load = request ? { request, generation: ++latestLoadRequestGeneration } : createLoadRequest();
  assertLoadRequestCurrent(load.request, load.generation);
  if (!session) {
    if (!sessionInitialization) { sessionInitialization = Promise.resolve().then(() => { if (session) return session; const created = createUnifiedMediaSession(config); session = created; queueItem(item); observeSession(created); return created; }).finally(() => { sessionInitialization = null; }); }
    const initialized = await sessionInitialization;
    assertLoadRequestCurrent(load.request, load.generation);
    if (!session || session !== initialized) throw new Error('JHADINA_MEDIA_PLAYBACK_SESSION_INITIALIZATION_LOST');
  }
  const sharedSession = session;
  return enqueueSessionCommand(async () => {
    assertLoadRequestCurrent(load.request, load.generation);
    if (!session || session !== sharedSession) throw new Error('JHADINA_MEDIA_PLAYBACK_SESSION_OWNERSHIP_LOST');
    const current = getMediaPlaybackStore().getState().current;
    if (!current || current.id !== item.id || current.playback.source.id !== item.playback.source.id || current.playback.source.url !== item.playback.source.url || current.playback.providerId !== item.playback.providerId || current.kind !== item.kind) {
      await sharedSession.loadPlayback(item.playback, 0, item.kind);
      assertLoadRequestCurrent(load.request, load.generation);
      if (!session || session !== sharedSession) throw new Error('JHADINA_MEDIA_PLAYBACK_SESSION_OWNERSHIP_LOST');
      queueItem(item);
      publishSnapshot();
    }
    return sharedSession;
  }, load.request, load.generation);
}

export function createMediaPlaybackLoadRequest(): MediaPlaybackLoadRequest { return createLoadRequest().request; }
export function releaseMediaPlaybackView(): void { publishSnapshot(); }
export function disposeMediaPlaybackSession(): void { sessionCommandGeneration += 1; sessionGeneration += 1; latestLoadRequestGeneration += 1; unsubscribeSession?.(); unsubscribeSession = null; progressPersistence?.dispose(); progressPersistence = null; progressPersistenceConfig = null; const currentSession = session; session = null; currentSession?.dispose(); publishSnapshot(); }
/** @deprecated Use releaseMediaPlaybackView() or disposeMediaPlaybackSession(). */
export function detachMediaPlaybackSession(): void { releaseMediaPlaybackView(); }
/** @deprecated Direct attachment is retained only for compatibility. New routes should use ensureMediaPlaybackSession(). */
export function attachMediaPlaybackSession(nextSession: UnifiedMediaSession, item: MediaQueueItem): void { if (session && session !== nextSession) throw new Error('JHADINA_MEDIA_PLAYBACK_SESSION_ALREADY_OWNED'); session = nextSession; queueItem(item); observeSession(nextSession); }
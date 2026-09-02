import type { MediaPlaybackProgress, MediaPlaybackStore, MediaQueueItem, MediaSessionState, UnifiedMediaSession } from '@jhadina/tv-core';
import { getMediaPlaybackStore } from './media-playback-runtime';

export interface MediaPlaybackProgressWriterClient {
  upsert(progress: MediaPlaybackProgress): Promise<MediaPlaybackProgress>;
}

export interface MediaPlaybackProgressWriter {
  flush(completed?: boolean): Promise<void>;
  dispose(): void;
}

export interface MediaPlaybackProgressWriterDeps {
  video: HTMLVideoElement;
  session: UnifiedMediaSession;
  item?: MediaQueueItem;
  store?: MediaPlaybackStore;
  userId: string;
  client: MediaPlaybackProgressWriterClient;
  throttleMs?: number;
  onError?: (error: unknown) => void;
}

function buildProgress(userId: string, item: MediaQueueItem, state: MediaSessionState, completed = false): MediaPlaybackProgress {
  const positionSeconds = Number.isFinite(state.positionSeconds) ? Math.max(0, state.positionSeconds) : 0;
  const durationSeconds = Number.isFinite(state.durationSeconds) ? Math.max(0, state.durationSeconds ?? 0) : item.durationSeconds;
  return { userId, providerId: item.playback.providerId, itemId: item.id, positionMs: Math.max(0, Math.trunc(positionSeconds * 1000)), durationMs: durationSeconds === undefined ? undefined : Math.max(0, Math.trunc(durationSeconds * 1000)), completed, updatedAt: new Date().toISOString() };
}

export function createMediaPlaybackProgressApiClient(fetchImpl: typeof fetch = fetch): MediaPlaybackProgressWriterClient {
  return {
    async upsert(progress) {
      const response = await fetchImpl('/api/media/progress', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'upsert', userId: progress.userId, providerId: progress.providerId, itemId: progress.itemId, progress }) });
      if (!response.ok) throw new Error('Unable to save playback progress.');
      const payload = (await response.json()) as { progress?: MediaPlaybackProgress };
      if (!payload.progress) throw new Error('Playback progress save returned no record.');
      return payload.progress;
    },
  };
}

export function attachMediaPlaybackProgressWriter({ video, session, item, store, userId, client, throttleMs = 5000, onError }: MediaPlaybackProgressWriterDeps): MediaPlaybackProgressWriter {
  const playbackStore = store ?? getMediaPlaybackStore();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;
  let writeInFlight: Promise<void> | null = null;
  let pending: { item: MediaQueueItem; completed: boolean } | null = null;
  let generation = 0;

  const currentItem = () => playbackStore.getState().current ?? item ?? null;

  const drain = async () => {
    if (disposed || writeInFlight || !pending) return;
    const generationAtStart = generation;
    const next = pending;
    pending = null;
    const progress = buildProgress(userId, next.item, session.getState(), next.completed);
    writeInFlight = client.upsert(progress)
      .then(() => undefined)
      .catch((error) => { onError?.(error); })
      .finally(() => { writeInFlight = null; if (!disposed && generation === generationAtStart) void drain(); else if (!disposed && pending) void drain(); });
    await writeInFlight;
  };

  const requestWrite = (completed = false) => {
    if (disposed) return Promise.resolve();
    const current = currentItem();
    if (!current) return Promise.resolve();
    pending = { item: current, completed: completed || pending?.completed === true };
    return drain();
  };

  const schedule = () => {
    if (disposed || timer) return;
    timer = setTimeout(() => { timer = null; void requestWrite(false); }, throttleMs);
  };
  const handlePause = () => { void requestWrite(false); };
  const handleEnded = () => { void requestWrite(true); };
  const handleTimeUpdate = () => schedule();
  const handleVisibility = () => { if (document.visibilityState === 'hidden') void requestWrite(false); };
  const handlePageHide = () => { void requestWrite(false); };

  video.addEventListener('timeupdate', handleTimeUpdate);
  video.addEventListener('pause', handlePause);
  video.addEventListener('ended', handleEnded);
  window.addEventListener('pagehide', handlePageHide);
  document.addEventListener('visibilitychange', handleVisibility);

  return {
    flush: (completed = false) => requestWrite(completed),
    dispose() {
      if (disposed) return;
      disposed = true;
      generation += 1;
      if (timer) clearTimeout(timer);
      timer = null;
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('visibilitychange', handleVisibility);
    },
  };
}

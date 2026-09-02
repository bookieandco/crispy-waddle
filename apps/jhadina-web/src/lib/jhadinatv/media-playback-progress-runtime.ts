import type { MediaPlaybackProgress, MediaQueueItem, MediaSessionState, UnifiedMediaSession } from '@jhadina/tv-core';

export interface RuntimeProgressClient { upsert(progress: MediaPlaybackProgress): Promise<MediaPlaybackProgress>; }
export interface RuntimeProgressPersistence { flush(completed?: boolean): Promise<void>; dispose(): void; }
export interface RuntimeProgressPersistenceDeps { session: UnifiedMediaSession; getCurrentItem: () => MediaQueueItem | null; userId: string; client: RuntimeProgressClient; throttleMs?: number; onError?: (error: unknown) => void; }

function buildProgress(userId: string, item: MediaQueueItem, state: MediaSessionState, completed: boolean): MediaPlaybackProgress {
  const positionSeconds = Number.isFinite(state.positionSeconds) ? Math.max(0, state.positionSeconds) : 0;
  const durationSeconds = Number.isFinite(state.durationSeconds) ? Math.max(0, state.durationSeconds ?? 0) : item.durationSeconds;
  return { userId, providerId: item.playback.providerId, itemId: item.id, positionMs: Math.max(0, Math.trunc(positionSeconds * 1000)), durationMs: durationSeconds === undefined ? undefined : Math.max(0, Math.trunc(durationSeconds * 1000)), completed, updatedAt: new Date().toISOString() };
}

export function createMediaPlaybackProgressApiClient(fetchImpl: typeof fetch = fetch): RuntimeProgressClient {
  return { async upsert(progress) { const response = await fetchImpl('/api/media/progress', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'upsert', userId: progress.userId, providerId: progress.providerId, itemId: progress.itemId, progress }) }); if (!response.ok) throw new Error(`JHADINA_MEDIA_PLAYBACK_PROGRESS_FAILED:${response.status}`); const payload = (await response.json()) as { progress?: MediaPlaybackProgress }; if (!payload.progress) throw new Error('JHADINA_MEDIA_PLAYBACK_PROGRESS_FAILED:no_result'); return payload.progress; } };
}

type Pending = { item: MediaQueueItem; state: MediaSessionState; completed: boolean };

export function attachRuntimeProgressPersistence({ session, getCurrentItem, userId, client, throttleMs = 5000, onError }: RuntimeProgressPersistenceDeps): RuntimeProgressPersistence {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;
  let inFlight: Promise<void> | null = null;
  let pending: Pending | null = null;
  let lastPlaying = session.getState().playing;
  let sequence = 0;
  let persistedSequence = 0;

  const drain = async (): Promise<void> => {
    if (disposed || inFlight || !pending) return;
    const next = pending;
    pending = null;
    const writeSequence = ++sequence;
    inFlight = client.upsert(buildProgress(userId, next.item, next.state, next.completed))
      .then(() => { persistedSequence = Math.max(persistedSequence, writeSequence); })
      .catch((error) => { onError?.(error); })
      .finally(() => { inFlight = null; if (!disposed && pending) void drain(); });
    await inFlight;
  };

  const requestWrite = (completed = false): Promise<void> => {
    if (disposed) return Promise.resolve();
    const item = getCurrentItem();
    if (!item) return Promise.resolve();
    const state = { ...session.getState() };
    const inferredCompleted = completed || (!state.playing && state.durationSeconds !== undefined && Number.isFinite(state.durationSeconds) && state.durationSeconds > 0 && state.positionSeconds >= state.durationSeconds - 0.5);
    pending = { item, state, completed: inferredCompleted || pending?.completed === true };
    if (inFlight) return inFlight;
    return drain();
  };

  const schedule = () => { if (disposed || timer) return; timer = setTimeout(() => { timer = null; void requestWrite(false); }, throttleMs); };
  const unsubscribe = session.subscribe((state) => { if (disposed) return; const becamePaused = lastPlaying && !state.playing; lastPlaying = state.playing; if (becamePaused) void requestWrite(false); else if (state.playing) schedule(); });
  const handleVisibility = () => { if (document.visibilityState === 'hidden') void requestWrite(false); };
  const handlePageHide = () => { void requestWrite(false); };
  window.addEventListener('pagehide', handlePageHide);
  document.addEventListener('visibilitychange', handleVisibility);

  const flush = async (completed = false): Promise<void> => {
    if (timer) clearTimeout(timer);
    timer = null;
    await requestWrite(completed);
    while (!disposed && (inFlight || pending)) { if (inFlight) await inFlight; else await drain(); }
    // A completed flush only returns once the newest pending snapshot has been handed
    // to the client. This prevents route transitions from advancing the queue before
    // the old item's final progress write is ordered ahead of the transition.
    void persistedSequence;
  };

  const dispose = () => { if (disposed) return; disposed = true; if (timer) clearTimeout(timer); timer = null; unsubscribe(); window.removeEventListener('pagehide', handlePageHide); document.removeEventListener('visibilitychange', handleVisibility); };
  return { flush, dispose };
}

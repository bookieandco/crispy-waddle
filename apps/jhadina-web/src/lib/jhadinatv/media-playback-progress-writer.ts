import type { MediaPlaybackProgress, MediaQueueItem, MediaSessionState, UnifiedMediaSession } from '@jhadina/tv-core';

export interface MediaPlaybackProgressWriterClient {
  upsert(progress: MediaPlaybackProgress): Promise<MediaPlaybackProgress>;
}

export interface MediaPlaybackProgressWriterDeps {
  video: HTMLVideoElement;
  session: UnifiedMediaSession;
  item: MediaQueueItem;
  userId: string;
  client: MediaPlaybackProgressWriterClient;
  throttleMs?: number;
  onError?: (error: unknown) => void;
}

function buildProgress(userId: string, item: MediaQueueItem, state: MediaSessionState, completed = false): MediaPlaybackProgress {
  const durationSeconds = Number.isFinite(state.durationSeconds) ? Math.max(0, state.durationSeconds ?? 0) : item.durationSeconds;
  return {
    userId,
    providerId: item.playback.providerId,
    itemId: item.id,
    positionMs: Math.max(0, Math.trunc(state.positionSeconds * 1000)),
    durationMs: durationSeconds === undefined ? undefined : Math.max(0, Math.trunc(durationSeconds * 1000)),
    completed,
    updatedAt: new Date().toISOString(),
  };
}

export function createMediaPlaybackProgressApiClient(fetchImpl: typeof fetch = fetch): MediaPlaybackProgressWriterClient {
  return {
    async upsert(progress) {
      const response = await fetchImpl('/api/media/progress', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'upsert',
          userId: progress.userId,
          providerId: progress.providerId,
          itemId: progress.itemId,
          progress,
        }),
      });
      if (!response.ok) throw new Error('Unable to save playback progress.');
      const payload = (await response.json()) as { progress?: MediaPlaybackProgress };
      if (!payload.progress) throw new Error('Playback progress save returned no record.');
      return payload.progress;
    },
  };
}

export function attachMediaPlaybackProgressWriter({ video, session, item, userId, client, throttleMs = 5000, onError }: MediaPlaybackProgressWriterDeps): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;
  let writeInFlight: Promise<unknown> | null = null;
  let pending: MediaPlaybackProgress | null = null;

  const write = (completed = false) => {
    if (disposed) return;
    const progress = buildProgress(userId, item, session.getState(), completed);
    pending = progress;
    if (writeInFlight) return;
    writeInFlight = client.upsert(progress).catch((error) => onError?.(error)).finally(() => {
      writeInFlight = null;
      if (!disposed && pending && pending !== progress) write(false);
    });
  };
  const schedule = () => {
    if (disposed || timer) return;
    timer = setTimeout(() => { timer = null; write(false); }, throttleMs);
  };
  const handlePause = () => write(false);
  const handleEnded = () => write(true);
  const handleTimeUpdate = () => schedule();
  const handleVisibility = () => { if (document.visibilityState === 'hidden') write(false); };

  video.addEventListener('timeupdate', handleTimeUpdate);
  video.addEventListener('pause', handlePause);
  video.addEventListener('ended', handleEnded);
  document.addEventListener('visibilitychange', handleVisibility);

  return () => {
    disposed = true;
    if (timer) clearTimeout(timer);
    timer = null;
    video.removeEventListener('timeupdate', handleTimeUpdate);
    video.removeEventListener('pause', handlePause);
    video.removeEventListener('ended', handleEnded);
    document.removeEventListener('visibilitychange', handleVisibility);
  };
}

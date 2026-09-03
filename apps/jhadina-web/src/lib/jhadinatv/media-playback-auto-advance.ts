import type { MediaPlaybackStore, MediaQueueItem, UnifiedMediaSession } from '@jhadina/tv-core';

export const MEDIA_PLAYBACK_AUTO_ADVANCE_CANCELLED = 'JHADINA_MEDIA_PLAYBACK_AUTO_ADVANCE_CANCELLED';

export interface MediaPlaybackAutoAdvanceDeps {
  video: HTMLVideoElement;
  store: MediaPlaybackStore;
  session: UnifiedMediaSession;
  resolveResumePosition?: (item: MediaQueueItem) => Promise<number>;
  beforeAdvance?: (item: MediaQueueItem) => Promise<void>;
  onError?: (error: unknown) => void;
  isActive?: () => boolean;
}

export function attachMediaPlaybackAutoAdvance({ video, store, session, resolveResumePosition, beforeAdvance, onError, isActive = () => true }: MediaPlaybackAutoAdvanceDeps): () => void {
  let advancing = false;
  let generation = 0;

  const assertActive = (requestGeneration: number): void => {
    if (requestGeneration !== generation || !isActive()) throw new Error(MEDIA_PLAYBACK_AUTO_ADVANCE_CANCELLED);
  };

  const handleEnded = () => {
    if (advancing || session.isRemote()) return;
    const requestGeneration = generation;
    const before = store.getState();
    const previous = before.current;
    const previousIndex = before.queueIndex;
    if (!previous) return;

    advancing = true;
    void (beforeAdvance ? beforeAdvance(previous) : Promise.resolve())
      .then(() => {
        assertActive(requestGeneration);
        return store.next();
      })
      .then((next) => {
        assertActive(requestGeneration);
        if (!next) return null;
        return (resolveResumePosition ? resolveResumePosition(next) : Promise.resolve(0)).then((positionSeconds) => ({ next, positionSeconds }));
      })
      .then((result) => {
        if (!result) return;
        assertActive(requestGeneration);
        return session.loadPlayback(result.next.playback, result.positionSeconds, result.next.kind).then(() => {
          assertActive(requestGeneration);
          return session.play();
        });
      })
      .catch((error) => {
        const after = store.getState();
        if (isActive() && after.current?.id !== previous.id) store.setCurrent(previous, previousIndex);
        if (error instanceof Error && error.message === MEDIA_PLAYBACK_AUTO_ADVANCE_CANCELLED) return;
        onError?.(error);
      })
      .finally(() => { advancing = false; });
  };

  video.addEventListener('ended', handleEnded);
  return () => {
    generation += 1;
    video.removeEventListener('ended', handleEnded);
  };
}

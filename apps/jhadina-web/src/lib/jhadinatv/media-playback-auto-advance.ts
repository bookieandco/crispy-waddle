import type { MediaPlaybackStore, MediaQueueItem, UnifiedMediaSession } from '@jhadina/tv-core';

export interface MediaPlaybackAutoAdvanceDeps {
  video: HTMLVideoElement;
  store: MediaPlaybackStore;
  session: UnifiedMediaSession;
  resolveResumePosition?: (item: MediaQueueItem) => Promise<number>;
  beforeAdvance?: (item: MediaQueueItem) => Promise<void>;
  onError?: (error: unknown) => void;
}

export function attachMediaPlaybackAutoAdvance({ video, store, session, resolveResumePosition, beforeAdvance, onError }: MediaPlaybackAutoAdvanceDeps): () => void {
  let advancing = false;

  const handleEnded = () => {
    if (advancing || session.isRemote()) return;
    const before = store.getState();
    const previous = before.current;
    const previousIndex = before.queueIndex;
    if (!previous) return;

    advancing = true;
    void (beforeAdvance ? beforeAdvance(previous) : Promise.resolve())
      .then(() => store.next())
      .then((next) => {
        if (!next) return null;
        return (resolveResumePosition ? resolveResumePosition(next) : Promise.resolve(0)).then((positionSeconds) => ({ next, positionSeconds }));
      })
      .then((result) => {
        if (!result) return;
        return session.loadPlayback(result.next.playback, result.positionSeconds, result.next.kind).then(() => session.play());
      })
      .catch((error) => {
        const after = store.getState();
        if (after.current?.id !== previous.id) store.setCurrent(previous, previousIndex);
        onError?.(error);
      })
      .finally(() => { advancing = false; });
  };

  video.addEventListener('ended', handleEnded);
  return () => video.removeEventListener('ended', handleEnded);
}

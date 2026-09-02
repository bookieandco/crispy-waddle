import type { MediaPlaybackStore, UnifiedMediaSession } from '@jhadina/tv-core';

export interface MediaPlaybackAutoAdvanceDeps {
  video: HTMLVideoElement;
  store: MediaPlaybackStore;
  session: UnifiedMediaSession;
  resolveResumePosition?: (item: { id: string; titleId: string; playback: { providerId: string } }) => Promise<number>;
  onError?: (error: unknown) => void;
}

export function attachMediaPlaybackAutoAdvance({ video, store, session, resolveResumePosition, onError }: MediaPlaybackAutoAdvanceDeps): () => void {
  let advancing = false;

  const handleEnded = () => {
    if (advancing || session.isRemote()) return;

    const before = store.getState();
    const previous = before.current;
    const previousIndex = before.queueIndex;
    const next = store.next();
    if (!next) return;

    advancing = true;
    void (resolveResumePosition ? resolveResumePosition(next) : Promise.resolve(0))
      .then((positionSeconds) => session.loadPlayback(next.playback, positionSeconds))
      .then(() => session.play())
      .catch((error) => {
        const after = store.getState();
        if (after.current?.id === next.id && previous) {
          store.setCurrent(previous, previousIndex);
        }
        onError?.(error);
      })
      .finally(() => {
        advancing = false;
      });
  };

  video.addEventListener('ended', handleEnded);
  return () => video.removeEventListener('ended', handleEnded);
}

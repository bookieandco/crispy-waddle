import type { MediaPlaybackStore, UnifiedMediaSession } from '@jhadina/tv-core';

export interface MediaPlaybackAutoAdvanceDeps {
  video: HTMLVideoElement;
  store: MediaPlaybackStore;
  session: UnifiedMediaSession;
  onError?: (error: unknown) => void;
}

export function attachMediaPlaybackAutoAdvance({ video, store, session, onError }: MediaPlaybackAutoAdvanceDeps): () => void {
  let advancing = false;

  const handleEnded = () => {
    if (advancing || session.isRemote()) return;

    const before = store.getState();
    const previous = before.current;
    const previousIndex = before.queueIndex;
    const next = store.next();
    if (!next) return;

    advancing = true;
    void session.loadPlayback(next.playback)
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

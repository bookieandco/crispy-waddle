import type { MediaSessionSnapshot, PlaybackTarget } from './media-domain';
import type { LocalPlaybackAdapter } from './media-session';

export interface BrowserMediaElement extends HTMLMediaElement {
  webkitShowPlaybackTargetPicker?: () => void;
}

export interface BrowserPlaybackHost {
  readonly element: BrowserMediaElement;
  adapter(): LocalPlaybackAdapter;
  dispose(): void;
}

export function createBrowserPlaybackHost(element: BrowserMediaElement, initial?: Partial<MediaSessionSnapshot>): BrowserPlaybackHost {
  const target: PlaybackTarget = { id: 'local', name: 'This device', transport: 'local' };
  const snapshot = (): MediaSessionSnapshot => ({
    ...initial,
    item: initial?.item,
    queue: initial?.queue ?? { items: [], currentIndex: -1, shuffle: false, repeat: 'off' },
    playback: {
      status: element.ended ? 'ended' : element.paused ? (element.currentTime > 0 ? 'paused' : 'ready') : 'playing',
      positionMs: Math.max(0, element.currentTime * 1000),
      durationMs: Number.isFinite(element.duration) ? element.duration * 1000 : initial?.playback.durationMs,
      volume: element.volume,
      rate: element.playbackRate,
      muted: element.muted,
      error: initial?.playback.error,
      updatedAt: Date.now(),
    },
    target,
  });
  const adapter: LocalPlaybackAdapter = {
    getState: snapshot,
    async apply(command) {
      if (command.type === 'play') await element.play();
      else if (command.type === 'pause') element.pause();
      else if (command.type === 'seek') element.currentTime = Math.max(0, command.value);
      else if (command.type === 'set-volume') element.volume = Math.max(0, Math.min(1, command.value));
    },
    onStateChange(listener) {
      const sync = () => listener(snapshot());
      const events = ['play', 'pause', 'ended', 'timeupdate', 'durationchange', 'volumechange', 'ratechange', 'seeking', 'seeked', 'error'] as const;
      events.forEach((event) => element.addEventListener(event, sync));
      sync();
      return () => events.forEach((event) => element.removeEventListener(event, sync));
    },
  };
  return { element, adapter: () => adapter, dispose() {} };
}

import type { LocalPlaybackAdapter, MediaSessionCommand, MediaSessionState } from '@jhadina/tv-core';
import type { MediaElementEventLease } from './media-element-event-owner';

/**
 * Binds a local playback adapter to the current persistent-media-element lease.
 * The guard is deliberately outside tv-core so the core remains browser/runtime
 * agnostic while the route owns the DOM element authority.
 */
export interface MediaElementCommandGuard extends LocalPlaybackAdapter {
  readonly isCurrent: () => boolean;
}

const MEDIA_ELEMENT_COMMAND_CANCELLED = 'JHADINA_MEDIA_ELEMENT_COMMAND_CANCELLED';

function assertCurrent(lease: MediaElementEventLease): void {
  if (!lease.isCurrent()) throw new Error(MEDIA_ELEMENT_COMMAND_CANCELLED);
}

export function createGuardedLocalPlaybackAdapter(
  adapter: LocalPlaybackAdapter,
  lease: MediaElementEventLease,
): MediaElementCommandGuard {
  return {
    getState: () => adapter.getState(),
    isCurrent: lease.isCurrent,
    async apply(command: Exclude<MediaSessionCommand, { type: 'transfer' }>) {
      assertCurrent(lease);
      await adapter.apply(command);
      assertCurrent(lease);
    },
    setSource(url: string) {
      assertCurrent(lease);
      adapter.setSource(url);
      assertCurrent(lease);
    },
    onStateChange(listener: (state: MediaSessionState) => void) {
      return adapter.onStateChange ? adapter.onStateChange((state) => {
        if (lease.isCurrent()) listener(state);
      }) : () => undefined;
    },
  };
}

export { MEDIA_ELEMENT_COMMAND_CANCELLED };

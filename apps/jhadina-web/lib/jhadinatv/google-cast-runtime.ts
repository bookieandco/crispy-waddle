import type { GoogleCastRuntime, GoogleCastSession, ResolvedPlaybackSource } from '@jhadina/tv-core';
import { toCastMediaDescriptor } from '@jhadina/tv-core';

declare global {
  interface Window { cast?: { framework?: { CastContext?: { getInstance(): { requestSession(): Promise<unknown>; }; }; }; }; }
}

interface CastSessionLike { loadMedia?: (request: unknown) => Promise<void>; sendMessage?: (namespace: string, message: unknown) => Promise<void>; endSession?: (stopCasting?: boolean) => Promise<void>; }

export function createBrowserGoogleCastRuntime(): GoogleCastRuntime {
  return {
    isSupported: () => typeof window !== 'undefined' && !!window.cast?.framework?.CastContext,
    async requestSession(): Promise<GoogleCastSession> {
      const session = await window.cast!.framework!.CastContext!.getInstance().requestSession() as CastSessionLike;
      if (!session) throw new Error('Google Cast session was not created.');
      return {
        async loadMedia(playback: ResolvedPlaybackSource, positionSeconds = 0) {
          if (!session.loadMedia) throw new Error('Google Cast session does not expose media loading.');
          const media = toCastMediaDescriptor(playback);
          await session.loadMedia({ mediaInfo: media, currentTime: positionSeconds, autoplay: true });
        },
        async send(command) {
          if (!session.sendMessage) throw new Error('Google Cast session does not expose messaging.');
          await session.sendMessage('urn:x-cast:com.jhadina.tv', command);
        },
        async getState() { return null; },
        async end() { await session.endSession?.(true); },
      };
    },
  };
}

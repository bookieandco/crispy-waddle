import type { GoogleCastRuntime, GoogleCastSession } from '@jhadina/tv-core';

declare global {
  interface Window {
    cast?: { framework?: { CastContext?: { getInstance(): { requestSession(): Promise<unknown>; } }; } };
    chrome?: { cast?: { isAvailable?: boolean; AutoJoinPolicy?: unknown } };
  }
}

interface CastMedia { contentId: string; contentType: string; streamType?: string; }
interface CastSessionLike { getMediaSession?: () => unknown; loadMedia?: (request: unknown) => Promise<void>; sendMessage?: (namespace: string, message: unknown) => Promise<void>; endSession?: (stopCasting?: boolean) => Promise<void>; }

function getSession(): CastSessionLike { const context = window.cast?.framework?.CastContext?.getInstance(); if (!context) throw new Error('Google Cast SDK is not available.'); return context.requestSession as unknown as CastSessionLike; }

export function createBrowserGoogleCastRuntime(): GoogleCastRuntime {
  return {
    isSupported: () => typeof window !== 'undefined' && !!window.cast?.framework?.CastContext,
    async requestSession(): Promise<GoogleCastSession> {
      const session = await (window.cast!.framework!.CastContext!.getInstance().requestSession() as Promise<CastSessionLike>);
      if (!session) throw new Error('Google Cast session was not created.');
      return {
        async loadMedia(sourceUrl, positionSeconds = 0) {
          if (!session.loadMedia) throw new Error('Google Cast session does not expose media loading.');
          const media: CastMedia = { contentId: sourceUrl, contentType: 'video/mp4', streamType: 'BUFFERED' };
          await session.loadMedia({ mediaInfo: media, currentTime: positionSeconds, autoplay: true });
        },
        async send(command) {
          const namespace = 'urn:x-cast:com.jhadina.tv';
          if (!session.sendMessage) throw new Error('Google Cast session does not expose messaging.');
          await session.sendMessage(namespace, command);
        },
        async getState() { return null; },
        async end() { await session.endSession?.(true); },
      };
    },
  };
}

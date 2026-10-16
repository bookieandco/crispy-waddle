import type { GoogleCastRuntime, GoogleCastSession } from '@jhadina/tv-core';

declare global {
  interface Window {
    cast?: { framework?: { CastContext?: { getInstance(): { requestSession(): Promise<unknown>; } }; } };
    chrome?: { cast?: { isAvailable?: boolean; AutoJoinPolicy?: unknown } };
  }
}

interface CastMedia { contentId: string; contentType: string; streamType?: string; }
/** Refuse opaque/transcoded proxies until MIME/stream mode is verified by a real receiver. */
export function admittedCastMedia(sourceUrl: string): CastMedia {
  const url = new URL(sourceUrl);
  if (url.protocol !== 'https:') throw new Error('Casting requires a trusted HTTPS source.');
  if (/\\.m3u8$/i.test(url.pathname)) return { contentId: sourceUrl, contentType: 'application/x-mpegURL', streamType: 'LIVE' };
  if (/\\.mp4$/i.test(url.pathname)) return { contentId: sourceUrl, contentType: 'video/mp4', streamType: 'BUFFERED' };
  if (/\\.mpd$/i.test(url.pathname)) return { contentId: sourceUrl, contentType: 'application/dash+xml', streamType: 'BUFFERED' };
  throw new Error('Casting format has not been verified for this provider. Use local playback until receiver certification.');
}
interface CastSessionLike { getMediaSession?: () => unknown; loadMedia?: (request: unknown) => Promise<void>; sendMessage?: (namespace: string, message: unknown) => Promise<void>; endSession?: (stopCasting?: boolean) => Promise<void>; }

export function createBrowserGoogleCastRuntime(): GoogleCastRuntime {
  return {
    isSupported: () => typeof window !== 'undefined' && !!window.cast?.framework?.CastContext,
    async requestSession(): Promise<GoogleCastSession> {
      const session = await (window.cast!.framework!.CastContext!.getInstance().requestSession() as Promise<CastSessionLike>);
      if (!session) throw new Error('Google Cast session was not created.');
      return {
        async loadMedia(sourceUrl, positionSeconds = 0) {
          if (!session.loadMedia) throw new Error('Google Cast session does not expose media loading.');
          const media = admittedCastMedia(sourceUrl);
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

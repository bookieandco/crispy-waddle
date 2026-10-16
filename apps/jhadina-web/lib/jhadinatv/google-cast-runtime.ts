import type { GoogleCastRuntime, GoogleCastSession } from '@jhadina/tv-core';

interface CastMediaInfo { streamType?:string; }
interface CastLoadRequest { currentTime?:number; autoplay?:boolean; }
interface CastSessionLike {
  getMediaSession?: () => unknown;
  loadMedia?: (request: CastLoadRequest) => Promise<void>;
  sendMessage?: (namespace: string, message: unknown) => Promise<void>;
  endSession?: (stopCasting?: boolean) => Promise<void>;
}
interface CastContextLike {
  requestSession():Promise<unknown>;
  getCurrentSession():CastSessionLike|null;
}
declare global {
  interface Window {
    cast?: { framework?: { CastContext?: { getInstance(): CastContextLike } } };
    chrome?: { cast?: {
      isAvailable?:boolean;
      AutoJoinPolicy?:unknown;
      media?: {
        MediaInfo: new (contentId:string,contentType:string)=>CastMediaInfo;
        LoadRequest: new (mediaInfo:CastMediaInfo)=>CastLoadRequest;
      };
    } };
  }
}

/** Require source-specific transport metadata; do not label every stream as MP4. */
function mediaContentType(sourceUrl:string):string {
  const pathname=new URL(sourceUrl).pathname.toLowerCase();
  if(pathname.endsWith('.mp4'))return 'video/mp4';
  if(pathname.endsWith('.m3u8'))return 'application/x-mpegurl';
  if(pathname.endsWith('.mpd'))return 'application/dash+xml';
  throw new Error('Google Cast source MIME type is unverified; provider metadata is required.');
}

export function createBrowserGoogleCastRuntime(): GoogleCastRuntime {
  return {
    isSupported: () => typeof window !== 'undefined' && !!window.cast?.framework?.CastContext &&
      !!window.chrome?.cast?.media?.MediaInfo && !!window.chrome?.cast?.media?.LoadRequest,
    async requestSession(): Promise<GoogleCastSession> {
      if(typeof window==='undefined')throw new Error('Google Cast requires a browser.');
      const context=window.cast?.framework?.CastContext?.getInstance();
      if(!context)throw new Error('Google Cast framework is not initialized.');
      // Web Sender requestSession() resolves an acquisition action, not a CastSession object.
      await context.requestSession();
      const session=context.getCurrentSession();
      if(!session)throw new Error('Google Cast request completed without a usable session.');
      return {
        async loadMedia(sourceUrl, positionSeconds = 0) {
          if(!session.loadMedia)throw new Error('Google Cast session does not expose media loading.');
          if(!sourceUrl.startsWith('https://'))throw new Error('Google Cast requires HTTPS media.');
          const mediaApi=window.chrome?.cast?.media;
          if(!mediaApi)throw new Error('Google Cast media constructors are unavailable.');
          const mediaInfo=new mediaApi.MediaInfo(sourceUrl,mediaContentType(sourceUrl));
          mediaInfo.streamType=sourceUrl.toLowerCase().includes('.m3u8')?'LIVE':'BUFFERED';
          const request=new mediaApi.LoadRequest(mediaInfo);
          request.currentTime=Math.max(0,positionSeconds);
          request.autoplay=true;
          await session.loadMedia(request);
        },
        async send(command) {
          const namespace='urn:x-cast:com.jhadina.tv';
          if(!session.sendMessage)throw new Error('Google Cast session does not expose messaging.');
          await session.sendMessage(namespace,command);
        },
        // A successful load promise is not a corroborated playback-state receipt.
        async getState() { return null; },
        async end() { await session.endSession?.(true); },
      };
    },
  };
}

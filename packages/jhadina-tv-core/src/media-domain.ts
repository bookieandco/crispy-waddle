export type MediaEntityKind = 'movie' | 'show' | 'season' | 'episode' | 'video' | 'track' | 'album' | 'artist' | 'podcast' | 'live-event' | 'sports-event' | 'generated-asset';
export type MediaProviderKind = 'youtube' | 'jhadina-library' | 'local' | 'jhadinatv' | 'licensed' | 'other';
export type MediaCapability = 'play' | 'pause' | 'seek' | 'queue' | 'cast' | 'download' | 'edit' | 'export';
export interface MediaItem { id:string; providerId:string; provider:MediaProviderKind; kind:MediaEntityKind; title:string; subtitle?:string; description?:string; artworkUrl?:string; backdropUrl?:string; durationMs?:number; canonicalUrl?:string; playbackUrl?:string; capabilities:MediaCapability[]; metadata?:Record<string,string|number|boolean|null>; }
export interface MediaQueue { items:MediaItem[]; currentIndex:number; shuffle:boolean; repeat:'off'|'one'|'all'; }
export type MediaPlaybackStatus='idle'|'loading'|'ready'|'playing'|'paused'|'buffering'|'ended'|'error';
export interface MediaPlaybackState { status:MediaPlaybackStatus; positionMs:number; durationMs?:number; volume:number; rate:number; muted?:boolean; error?:string; updatedAt?:number; }
export interface PlaybackTarget { id:string; name:string; transport:'local'|'cast'|'airplay'|'jhadinatv'|'remote'; }
export interface CaptionState { enabled:boolean; language?:string; }
export interface AudioTrackState { id?:string; language?:string; label?:string; }
export interface PlayerCapabilities { play:boolean; pause:boolean; seek:boolean; volume:boolean; captions:boolean; audioTracks:boolean; playbackRate:boolean; fullscreen:boolean; pictureInPicture:boolean; cast:boolean; }
export interface MediaSessionSnapshot { sessionId?:string; item?:MediaItem; queue:MediaQueue; playback:MediaPlaybackState; target?:PlaybackTarget; captions?:CaptionState; audioTrack?:AudioTrackState; capabilities?:PlayerCapabilities; }
export interface MediaSourceReference { providerId:string; itemId:string; url:string; type:'hls'|'dash'|'progressive'|'external'; }
export interface MediaProviderCapabilities { kinds:MediaEntityKind[]; supportsSearch:boolean; supportsBrowse:boolean; supportsSourceResolution:boolean; }
export interface MediaProvider { readonly id:string; readonly name:string; readonly capabilities:MediaProviderCapabilities; search(query:string):Promise<MediaItem[]>; get?(id:string):Promise<MediaItem|undefined>; resolveSources?(id:string):Promise<MediaSourceReference[]>; health?():Promise<{ok:boolean;message?:string}>; }

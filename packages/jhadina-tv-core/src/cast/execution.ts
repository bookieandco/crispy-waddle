import type { ResolvedPlaybackSource } from '../playback-resolver';

export interface CastMediaDescriptor {
  contentId: string;
  contentType: 'application/x-mpegURL' | 'application/dash+xml';
  streamType: 'BUFFERED';
}

export function assertCastablePlayback(playback: ResolvedPlaybackSource): ResolvedPlaybackSource {
  if (!playback.providerId) throw new Error('Cast playback requires a provider.');
  if (!playback.source.id) throw new Error('Cast playback source identity is invalid.');
  if (!playback.source.titleId) throw new Error('Cast playback source title identity is invalid.');
  if (!playback.source.url.startsWith('https://')) throw new Error('JhadinaTV casting requires an HTTPS media source.');
  if (playback.source.kind === 'external') throw new Error('External playback sources require an external cast receiver.');
  return playback;
}

export function toCastMediaDescriptor(playback: ResolvedPlaybackSource): CastMediaDescriptor {
  assertCastablePlayback(playback);
  return {
    contentId: playback.source.url,
    contentType: playback.source.kind === 'hls' ? 'application/x-mpegURL' : 'application/dash+xml',
    streamType: 'BUFFERED',
  };
}

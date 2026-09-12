import type { MediaTitle } from './index';

export interface MediaSourceAuthorization {
  status: 'authorized' | 'pending' | 'revoked';
  authorizedAt?: string;
  expiresAt?: string;
  territories?: string[];
  rightsEvidenceIds?: string[];
}

export interface MediaSource {
  id: string;
  titleId: string;
  kind: 'hls' | 'dash' | 'external';
  url: string;
  label?: string;
  subtitles?: Array<{ label: string; language: string; url: string }>;
  authorization?: MediaSourceAuthorization;
}

export interface MediaSourceAdapter {
  readonly id: string;
  readonly name: string;
  search(query: string): Promise<MediaTitle[]>;
  getSources(titleId: string): Promise<MediaSource[]>;
}

export function assertPlayableSource(source: MediaSource): MediaSource {
  const url = new URL(source.url);
  if (url.protocol !== 'https:') {
    throw new Error('JhadinaTV sources must use HTTPS URLs.');
  }
  return source;
}

export function assertAuthorizedSource(source: MediaSource, now = new Date()): MediaSource {
  assertPlayableSource(source);
  const authorization = source.authorization;
  if (!authorization || authorization.status !== 'authorized') {
    throw new Error(`JhadinaTV source is not authorized: ${source.id}`);
  }
  if (authorization.expiresAt && new Date(authorization.expiresAt).getTime() <= now.getTime()) {
    throw new Error(`JhadinaTV source authorization has expired: ${source.id}`);
  }
  return source;
}

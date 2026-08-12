import type { MediaKind } from './index';

export type PlaybackTransport = 'local' | 'airplay' | 'google-cast' | 'jhadinatv-tv';

export interface PlaybackTarget {
  id: string;
  name: string;
  transport: PlaybackTransport;
}

export interface MediaSessionState {
  titleId: string;
  kind: MediaKind;
  sourceUrl: string;
  positionSeconds: number;
  durationSeconds?: number;
  playing: boolean;
  target?: PlaybackTarget;
}

export interface MediaSessionCommand {
  type: 'play' | 'pause' | 'seek' | 'set-volume' | 'transfer';
  value?: number;
  target?: PlaybackTarget;
}

export interface MediaSessionController {
  readonly transport: PlaybackTransport;
  discoverTargets(): Promise<PlaybackTarget[]>;
  connect(target: PlaybackTarget): Promise<void>;
  disconnect(): Promise<void>;
  send(command: MediaSessionCommand): Promise<void>;
  getState(): Promise<MediaSessionState | null>;
}

export function buildTransferCommand(target: PlaybackTarget): MediaSessionCommand {
  return { type: 'transfer', target };
}

export function assertCastableSource(sourceUrl: string): string {
  if (!sourceUrl.startsWith('https://')) {
    throw new Error('JhadinaTV casting requires an HTTPS media source.');
  }
  return sourceUrl;
}

import type { MediaSessionCommand, MediaSessionController, MediaSessionState, PlaybackTarget } from '../casting';
import type { ResolvedPlaybackSource } from '../playback-resolver';
import { assertCastablePlayback } from './execution';

export interface JhadinaTVReceiverTransport {
  discover(): Promise<PlaybackTarget[]>;
  connect(target: PlaybackTarget): Promise<void>;
  load(playback: ResolvedPlaybackSource, positionSeconds: number): Promise<void>;
  send(command: MediaSessionCommand): Promise<void>;
  state(): Promise<MediaSessionState | null>;
  disconnect(): Promise<void>;
}

export function createJhadinaTVReceiverController(transport: JhadinaTVReceiverTransport, initialState: MediaSessionState, initialPlayback: ResolvedPlaybackSource): MediaSessionController {
  assertCastablePlayback(initialPlayback);
  let state = initialState;
  let playback = initialPlayback;
  let connected = false;
  return {
    transport: 'jhadinatv-tv',
    async discoverTargets() { return transport.discover(); },
    async connect(target) {
      if (target.transport !== 'jhadinatv-tv') throw new Error('JhadinaTV receiver requires a jhadinatv-tv target.');
      assertCastablePlayback(playback);
      await transport.connect(target);
      await transport.load(playback, state.positionSeconds);
      connected = true;
      state = { ...state, titleId: playback.source.titleId, sourceUrl: playback.source.url, target };
    },
    async disconnect() { if (connected) await transport.disconnect(); connected = false; state = { ...state, target: undefined }; },
    async loadPlayback(nextPlayback, positionSeconds = 0) {
      assertCastablePlayback(nextPlayback);
      if (!connected) throw new Error('JhadinaTV receiver is not connected.');
      await transport.load(nextPlayback, Math.max(0, positionSeconds));
      playback = nextPlayback;
      state = { ...state, titleId: nextPlayback.source.titleId, sourceUrl: nextPlayback.source.url, positionSeconds: Math.max(0, positionSeconds), playing: false };
    },
    async send(command) { if (!connected) throw new Error('JhadinaTV receiver is not connected.'); await transport.send(command); },
    async getState() { return connected ? transport.state() : state; },
  };
}

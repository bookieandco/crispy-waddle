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

export function createJhadinaTVReceiverController(transport: JhadinaTVReceiverTransport, initialState: MediaSessionState, playback: ResolvedPlaybackSource): MediaSessionController {
  assertCastablePlayback(playback);
  let state = initialState;
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
      state = { ...state, target };
    },
    async disconnect() { if (connected) await transport.disconnect(); connected = false; state = { ...state, target: undefined }; },
    async send(command) { if (!connected) throw new Error('JhadinaTV receiver is not connected.'); await transport.send(command); },
    async getState() { return connected ? transport.state() : state; },
  };
}

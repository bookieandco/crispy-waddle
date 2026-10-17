import type { MediaSessionCommand, MediaSessionController, MediaSessionState, PlaybackTarget } from '../casting';
import { assertCastableSource } from '../casting';

export interface GoogleCastRuntime {
  isSupported(): boolean;
  canLoadSource?(url: string): boolean;
  requestSession(): Promise<GoogleCastSession>;
}

export interface GoogleCastSession {
  loadMedia(sourceUrl: string, positionSeconds?: number): Promise<void>;
  send(command: MediaSessionCommand): Promise<void>;
  getState(): Promise<MediaSessionState | null>;
  end(): Promise<void>;
}

export function createGoogleCastController(runtime: GoogleCastRuntime, initialState: MediaSessionState): MediaSessionController {
  let session: GoogleCastSession | null = null;
  let state = initialState;
  const target: PlaybackTarget = { id: 'google-cast', name: 'Chromecast', transport: 'google-cast' };

  return {
    transport: 'google-cast',
    async discoverTargets() {
      return runtime.isSupported() && (runtime.canLoadSource?.(state.sourceUrl) ?? true) ? [target] : [];
    },
    async connect(nextTarget) {
      if (nextTarget.transport !== 'google-cast') throw new Error('Google Cast controller requires a google-cast target.');
      if (!runtime.isSupported()) throw new Error('Google Cast is not available in this browser.');
      assertCastableSource(state.sourceUrl);
      if (runtime.canLoadSource && !runtime.canLoadSource(state.sourceUrl)) throw new Error('Casting requires verified media format.');
      const requested = await runtime.requestSession();
      try {
        await requested.loadMedia(state.sourceUrl, state.positionSeconds);
      } catch (error) {
        // Do not leave a receiver connection alive if it rejected the media.
        await requested.end().catch(() => undefined);
        throw error;
      }
      session = requested;
      state = { ...state, target: nextTarget };
    },
    async disconnect() {
      if (session) await session.end();
      session = null;
      state = { ...state, target: undefined };
    },
    async send(command) {
      if (!session) throw new Error('Google Cast session is not connected.');
      await session.send(command);
      if (command.type === 'transfer' && command.target) state = { ...state, target: command.target };
    },
    async getState() {
      return session ? session.getState() : state;
    },
  };
}

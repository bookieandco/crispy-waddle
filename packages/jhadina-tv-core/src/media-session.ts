import type { MediaKind } from './index';
import type { CastingManager, MediaSessionCommand, MediaSessionState, PlaybackTarget, PlaybackTransport } from './casting';

export interface LocalPlaybackAdapter {
  getState(): MediaSessionState;
  apply(command: Exclude<MediaSessionCommand, { type: 'transfer' }>): Promise<void>;
  onStateChange?(listener: (state: MediaSessionState) => void): () => void;
}

export interface UnifiedMediaSession {
  getState(): MediaSessionState;
  subscribe(listener: (state: MediaSessionState) => void): () => void;
  play(): Promise<void>;
  pause(): Promise<void>;
  seek(positionSeconds: number): Promise<void>;
  setVolume(value: number): Promise<void>;
  discoverTargets(): Promise<PlaybackTarget[]>;
  transfer(target: PlaybackTarget): Promise<void>;
  disconnect(): Promise<void>;
}

export interface UnifiedMediaSessionConfig {
  titleId: string;
  kind: MediaKind;
  sourceUrl: string;
  local: LocalPlaybackAdapter;
  casting: CastingManager;
}

export function createUnifiedMediaSession(config: UnifiedMediaSessionConfig): UnifiedMediaSession {
  let state = config.local.getState();
  const listeners = new Set<(next: MediaSessionState) => void>();
  let unsubscribeLocal = config.local.onStateChange?.((next) => {
    state = { ...state, ...next, titleId: config.titleId, kind: config.kind, sourceUrl: config.sourceUrl };
    listeners.forEach((listener) => listener(state));
  });

  const publish = (next: MediaSessionState) => { state = next; listeners.forEach((listener) => listener(state)); };
  const localCommand = async (command: Exclude<MediaSessionCommand, { type: 'transfer' }>) => {
    await config.local.apply(command);
    const localState = config.local.getState();
    publish({ ...state, ...localState, target: { id: 'local', name: 'This device', transport: 'local' } });
  };

  return {
    getState: () => state,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    play: () => localCommand({ type: 'play' }),
    pause: () => localCommand({ type: 'pause' }),
    seek: (positionSeconds) => localCommand({ type: 'seek', value: positionSeconds }),
    setVolume: (value) => localCommand({ type: 'set-volume', value }),
    discoverTargets: () => config.casting.discover(),
    async transfer(target) {
      const current = config.local.getState();
      await config.casting.connect(target);
      await config.casting.send({ type: 'transfer', target });
      publish({ ...state, ...current, target });
    },
    async disconnect() {
      const remote = await config.casting.getState();
      await config.casting.disconnect();
      publish({ ...state, ...(remote ?? {}), target: { id: 'local', name: 'This device', transport: 'local' } });
    },
  };
}

export type { PlaybackTransport };

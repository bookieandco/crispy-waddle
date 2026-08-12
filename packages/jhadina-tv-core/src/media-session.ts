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
  let stopRemoteSync: (() => void) | null = null;
  let activeRemote = false;

  const publish = (next: MediaSessionState) => {
    state = next;
    listeners.forEach((listener) => listener(state));
  };

  config.local.onStateChange?.((next) => {
    if (activeRemote) return;
    publish({ ...state, ...next, titleId: config.titleId, kind: config.kind, sourceUrl: config.sourceUrl, target: { id: 'local', name: 'This device', transport: 'local' } });
  });

  const localCommand = async (command: Exclude<MediaSessionCommand, { type: 'transfer' }>) => {
    activeRemote = false;
    await config.local.apply(command);
    const localState = config.local.getState();
    publish({ ...state, ...localState, target: { id: 'local', name: 'This device', transport: 'local' } });
  };

  const startRemoteSync = () => {
    stopRemoteSync?.();
    stopRemoteSync = config.casting.subscribeState((remote) => {
      activeRemote = true;
      publish({ ...state, ...remote, titleId: config.titleId, kind: config.kind, sourceUrl: config.sourceUrl });
    });
  };

  return {
    getState: () => state,
    subscribe(listener) { listeners.add(listener); listener(state); return () => listeners.delete(listener); },
    play: () => localCommand({ type: 'play' }),
    pause: () => localCommand({ type: 'pause' }),
    seek: (positionSeconds) => localCommand({ type: 'seek', value: positionSeconds }),
    setVolume: (value) => localCommand({ type: 'set-volume', value }),
    discoverTargets: () => config.casting.discover(),
    async transfer(target) {
      const current = config.local.getState();
      await config.casting.connect(target);
      await config.casting.send({ type: 'transfer', target });
      activeRemote = true;
      publish({ ...state, ...current, target });
      startRemoteSync();
    },
    async disconnect() {
      stopRemoteSync?.(); stopRemoteSync = null;
      const remote = await config.casting.getState();
      await config.casting.disconnect();
      activeRemote = false;
      publish({ ...state, ...(remote ?? {}), target: { id: 'local', name: 'This device', transport: 'local' } });
    },
  };
}

export type { PlaybackTransport };

import type { MediaKind } from './index';
import type { CastingManager, MediaSessionCommand, MediaSessionState, PlaybackTarget, PlaybackTransport } from './casting';
import type { ResolvedPlaybackSource } from './playback-resolver';

export interface LocalPlaybackAdapter {
  getState(): MediaSessionState;
  apply(command: Exclude<MediaSessionCommand, { type: 'transfer' }>): Promise<void>;
  setSource?(url: string): void;
  onStateChange?(listener: (state: MediaSessionState) => void): () => void;
}

export interface UnifiedMediaSession {
  getState(): MediaSessionState;
  subscribe(listener: (state: MediaSessionState) => void): () => void;
  dispose(): void;
  loadPlayback(playback: ResolvedPlaybackSource, positionSeconds?: number): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  seek(positionSeconds: number): Promise<void>;
  setVolume(value: number): Promise<void>;
  discoverTargets(): Promise<PlaybackTarget[]>;
  syncRemoteState(): Promise<MediaSessionState | null>;
  transfer(target: PlaybackTarget): Promise<void>;
  disconnect(): Promise<void>;
  isRemote(): boolean;
  remotePlay(): Promise<void>;
  remotePause(): Promise<void>;
  remoteSeek(deltaSeconds: number): Promise<void>;
  remoteSeekTo(positionSeconds: number): Promise<void>;
  remoteSetVolume(value: number): Promise<void>;
}

export interface UnifiedMediaSessionConfig {
  titleId: string;
  kind: MediaKind;
  playback: ResolvedPlaybackSource;
  local: LocalPlaybackAdapter;
  casting: CastingManager;
}

function assertLoadablePlayback(playback: ResolvedPlaybackSource): void {
  if (!playback.providerId) throw new Error('Playback provider is required.');
  if (!playback.source.id || !playback.source.titleId) throw new Error('Playback source is incomplete.');
  if (!playback.source.url.startsWith('https://')) throw new Error('Playback source must use HTTPS.');
  if (playback.source.kind === 'external') throw new Error('External playback sources require an external playback executor.');
  for (const subtitle of playback.source.subtitles ?? []) {
    if (!subtitle.url.startsWith('https://')) throw new Error('Playback subtitle source must use HTTPS.');
  }
}

function normalizePosition(positionSeconds: number | undefined): number {
  if (positionSeconds === undefined || !Number.isFinite(positionSeconds)) return 0;
  return Math.max(0, positionSeconds);
}

export function createUnifiedMediaSession(config: UnifiedMediaSessionConfig): UnifiedMediaSession {
  assertLoadablePlayback(config.playback);
  if (!config.local.setSource) throw new Error('Local playback source switching is unavailable.');

  let playback = config.playback;
  let state: MediaSessionState = { ...config.local.getState(), titleId: config.playback.source.titleId, kind: config.kind, sourceUrl: config.playback.source.url };
  const listeners = new Set<(next: MediaSessionState) => void>();
  let remoteUnsubscribe: (() => void) | undefined;
  let localUnsubscribe: (() => void) | undefined;
  let disposed = false;
  let loadGeneration = 0;
  const assertActive = () => { if (disposed) throw new Error('Media session is disposed.'); };
  const publish = (next: MediaSessionState) => { if (disposed) return; state = next; listeners.forEach((listener) => listener(state)); };
  const localCommand = async (command: Exclude<MediaSessionCommand, { type: 'transfer' }>) => {
    assertActive(); await config.local.apply(command); assertActive();
    const localState = config.local.getState();
    publish({ ...state, ...localState, sourceUrl: playback.source.url, titleId: playback.source.titleId, target: { id: 'local', name: 'This device', transport: 'local' } });
  };
  const remoteCommand = async (command: Exclude<MediaSessionCommand, { type: 'transfer' }>) => {
    assertActive();
    if (!state.target || state.target.transport === 'local') throw new Error('No remote TV playback session is connected.');
    await config.casting.send(command); assertActive();
    const remote = await config.casting.getState();
    if (remote) publish({ ...state, ...remote, sourceUrl: playback.source.url, titleId: playback.source.titleId, target: state.target });
  };

  const session: UnifiedMediaSession = {
    getState: () => state,
    subscribe(listener) { if (disposed) throw new Error('Media session is disposed.'); listeners.add(listener); return () => listeners.delete(listener); },
    dispose() { if (disposed) return; disposed = true; localUnsubscribe?.(); localUnsubscribe = undefined; remoteUnsubscribe?.(); remoteUnsubscribe = undefined; listeners.clear(); },
    async loadPlayback(nextPlayback, positionSeconds = 0) {
      assertActive(); assertLoadablePlayback(nextPlayback);
      const generation = ++loadGeneration;
      const requestedPosition = normalizePosition(positionSeconds);
      const remoteTarget = state.target && state.target.transport !== 'local';
      if (remoteTarget) await config.casting.loadPlayback(nextPlayback, requestedPosition);
      else {
        config.local.setSource!(nextPlayback.source.url);
        if (requestedPosition > 0) await config.local.apply({ type: 'seek', value: requestedPosition });
      }
      assertActive();
      if (generation !== loadGeneration) return;
      playback = nextPlayback;
      const nextState = remoteTarget ? await config.casting.getState() : config.local.getState();
      if (generation !== loadGeneration) return;
      const actualPosition = nextState?.positionSeconds ?? requestedPosition;
      publish({ ...state, ...(nextState ?? {}), titleId: nextPlayback.source.titleId, kind: config.kind, sourceUrl: nextPlayback.source.url, positionSeconds: Math.max(0, actualPosition), playing: false });
    },
    play: () => state.target?.transport !== 'local' ? remoteCommand({ type: 'play' }) : localCommand({ type: 'play' }),
    pause: () => state.target?.transport !== 'local' ? remoteCommand({ type: 'pause' }) : localCommand({ type: 'pause' }),
    seek: (positionSeconds) => state.target?.transport !== 'local' ? remoteCommand({ type: 'seek', value: Math.max(0, positionSeconds) }) : localCommand({ type: 'seek', value: Math.max(0, positionSeconds) }),
    setVolume: (value) => state.target?.transport !== 'local' ? remoteCommand({ type: 'set-volume', value: Math.max(0, Math.min(1, value)) }) : localCommand({ type: 'set-volume', value: Math.max(0, Math.min(1, value)) }),
    discoverTargets: async () => { assertActive(); return config.casting.discover(); },
    async syncRemoteState() {
      assertActive();
      if (!state.target || state.target.transport === 'local') return null;
      const remote = await config.casting.getState();
      assertActive();
      if (!remote) return null;
      const next = { ...state, ...remote, kind: config.kind, sourceUrl: playback.source.url, titleId: playback.source.titleId, target: state.target };
      publish(next);
      return next;
    },
    async transfer(target) {
      assertActive();
      if (target.transport === 'local') {
        await session.disconnect();
        return;
      }
      const current = state;
      await config.casting.connect(target);
      assertActive();
      const remote = await config.casting.getState();
      publish({ ...current, ...(remote ?? {}), sourceUrl: playback.source.url, titleId: playback.source.titleId, target });
      remoteUnsubscribe?.();
      remoteUnsubscribe = config.casting.subscribeState((next) => publish({ ...state, ...next, sourceUrl: playback.source.url, titleId: playback.source.titleId, target }), 500);
    },
    async disconnect() {
      assertActive();
      const remote = await config.casting.getState();
      remoteUnsubscribe?.(); remoteUnsubscribe = undefined;
      await config.casting.disconnect(); assertActive();
      const local = config.local.getState(); const nextPosition = remote?.positionSeconds ?? local.positionSeconds;
      await config.local.apply({ type: 'seek', value: nextPosition });
      if (remote?.playing) await config.local.apply({ type: 'play' }); else await config.local.apply({ type: 'pause' });
      publish({ ...local, sourceUrl: playback.source.url, titleId: playback.source.titleId, positionSeconds: nextPosition, playing: !!remote?.playing, target: { id: 'local', name: 'This device', transport: 'local' } });
    },
    isRemote: () => state.target?.transport !== undefined && state.target.transport !== 'local',
    remotePlay: () => remoteCommand({ type: 'play' }),
    remotePause: () => remoteCommand({ type: 'pause' }),
    remoteSeek: (deltaSeconds) => remoteCommand({ type: 'seek', value: Math.max(0, state.positionSeconds + deltaSeconds) }),
    remoteSeekTo: (positionSeconds) => remoteCommand({ type: 'seek', value: Math.max(0, positionSeconds) }),
    remoteSetVolume: (value) => remoteCommand({ type: 'set-volume', value: Math.max(0, Math.min(1, value)) }),
  };

  localUnsubscribe = config.local.onStateChange?.((next) => {
    if (session.isRemote()) return;
    publish({ ...state, ...next, titleId: playback.source.titleId, kind: config.kind, sourceUrl: playback.source.url, target: { id: 'local', name: 'This device', transport: 'local' } });
  });
  return session;
}

export type { PlaybackTransport };

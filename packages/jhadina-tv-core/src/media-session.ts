import type { MediaEntityKind, MediaPlaybackState, MediaSessionSnapshot, PlaybackTarget } from './media-domain';
import type { CastingManager, MediaSessionCommand } from './casting';

export interface LocalPlaybackAdapter {
  getState(): MediaSessionSnapshot;
  apply(command: Exclude<MediaSessionCommand, { type: 'transfer' }>): Promise<void>;
  onStateChange?(listener: (state: MediaSessionSnapshot) => void): () => void;
}

export interface UnifiedMediaSession {
  getState(): MediaSessionSnapshot;
  subscribe(listener: (state: MediaSessionSnapshot) => void): () => void;
  play(): Promise<void>;
  pause(): Promise<void>;
  seek(positionSeconds: number): Promise<void>;
  setVolume(value: number): Promise<void>;
  discoverTargets(): Promise<PlaybackTarget[]>;
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
  sessionId?: string;
  itemId: string;
  itemKind: MediaEntityKind;
  sourceUrl: string;
  local: LocalPlaybackAdapter;
  casting: CastingManager;
}

function normalizePlayback(next: MediaSessionSnapshot['playback']): MediaPlaybackState {
  return { status: next.status ?? (next.positionMs > 0 ? 'paused' : 'idle'), positionMs: Math.max(0, next.positionMs ?? 0), durationMs: next.durationMs, volume: Math.max(0, Math.min(1, next.volume ?? 1)), rate: next.rate ?? 1, muted: next.muted, error: next.error, updatedAt: Date.now() };
}

export function createUnifiedMediaSession(config: UnifiedMediaSessionConfig): UnifiedMediaSession {
  let state = config.local.getState();
  const listeners = new Set<(next: MediaSessionSnapshot) => void>();
  let remoteUnsubscribe: (() => void) | undefined;
  const publish = (next: MediaSessionSnapshot) => { state = next; listeners.forEach((listener) => listener(state)); };
  const localCommand = async (command: Exclude<MediaSessionCommand, { type: 'transfer' }>) => { await config.local.apply(command); const localState = config.local.getState(); publish({ ...state, ...localState, playback: normalizePlayback(localState.playback), target: { id: 'local', name: 'This device', transport: 'local' } }); };
  const remoteCommand = async (command: Exclude<MediaSessionCommand, { type: 'transfer' }>) => { if (!state.target || state.target.transport === 'local') throw new Error('No remote TV playback session is connected.'); await config.casting.send(command); const remote = await config.casting.getState(); if (remote) publish({ ...state, playback: normalizePlayback({ ...state.playback, ...remote }), target: state.target }); };
  const session: UnifiedMediaSession = {
    getState: () => state,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    play: () => state.target?.transport !== 'local' ? remoteCommand({ type: 'play' }) : localCommand({ type: 'play' }),
    pause: () => state.target?.transport !== 'local' ? remoteCommand({ type: 'pause' }) : localCommand({ type: 'pause' }),
    seek: (positionSeconds) => state.target?.transport !== 'local' ? remoteCommand({ type: 'seek', value: Math.max(0, positionSeconds) }) : localCommand({ type: 'seek', value: Math.max(0, positionSeconds) }),
    setVolume: (value) => state.target?.transport !== 'local' ? remoteCommand({ type: 'set-volume', value: Math.max(0, Math.min(1, value)) }) : localCommand({ type: 'set-volume', value: Math.max(0, Math.min(1, value)) }),
    discoverTargets: () => config.casting.discover(),
    async transfer(target) { const current = config.local.getState(); await config.casting.connect(target); await config.casting.send({ type: 'transfer', target }); publish({ ...state, ...current, playback: normalizePlayback(current.playback), target }); remoteUnsubscribe?.(); remoteUnsubscribe = config.casting.subscribeState((next) => publish({ ...state, playback: normalizePlayback({ ...state.playback, ...next }), target }), 500); },
    async disconnect() { const remote = await config.casting.getState(); remoteUnsubscribe?.(); remoteUnsubscribe = undefined; await config.casting.disconnect(); const local = config.local.getState(); const nextPosition = remote?.positionSeconds ?? local.playback.positionMs / 1000; if (Number.isFinite(nextPosition)) await config.local.apply({ type: 'seek', value: nextPosition }); if (remote?.playing) await config.local.apply({ type: 'play' }); else await config.local.apply({ type: 'pause' }); const next = config.local.getState(); publish({ ...state, ...next, playback: normalizePlayback(next.playback), target: { id: 'local', name: 'This device', transport: 'local' } }); },
    isRemote: () => state.target?.transport !== undefined && state.target.transport !== 'local',
    remotePlay: () => remoteCommand({ type: 'play' }), remotePause: () => remoteCommand({ type: 'pause' }), remoteSeek: (deltaSeconds) => remoteCommand({ type: 'seek', value: Math.max(0, state.playback.positionMs / 1000 + deltaSeconds) }), remoteSeekTo: (positionSeconds) => remoteCommand({ type: 'seek', value: Math.max(0, positionSeconds) }), remoteSetVolume: (value) => remoteCommand({ type: 'set-volume', value: Math.max(0, Math.min(1, value)) }),
  };
  const unsubscribeLocal = config.local.onStateChange?.((next) => { if (session.isRemote()) return; publish({ ...state, ...next, sessionId: config.sessionId ?? state.sessionId, item: state.item ?? { id: config.itemId, providerId: 'unknown', provider: 'other', kind: config.itemKind, title: config.itemId, canonicalUrl: config.sourceUrl, capabilities: ['play', 'pause', 'seek', 'cast', 'queue'] }, playback: normalizePlayback(next.playback), target: { id: 'local', name: 'This device', transport: 'local' } }); });
  void unsubscribeLocal;
  return session;
}

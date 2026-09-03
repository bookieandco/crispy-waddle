import type { MediaKind } from './index';
import type { ResolvedPlaybackSource } from './playback-resolver';

export type PlaybackTransport = 'local' | 'airplay' | 'google-cast' | 'jhadinatv-tv';
export interface PlaybackTarget { id: string; name: string; transport: PlaybackTransport; }
export interface MediaSessionState { titleId: string; kind: MediaKind; sourceUrl: string; positionSeconds: number; durationSeconds?: number; playing: boolean; volume?: number; target?: PlaybackTarget; }
export interface MediaSessionCommand { type: 'play' | 'pause' | 'seek' | 'set-volume' | 'transfer'; value?: number; target?: PlaybackTarget; }
export interface MediaSessionController {
  readonly transport: PlaybackTransport;
  discoverTargets(): Promise<PlaybackTarget[]>;
  connect(target: PlaybackTarget): Promise<void>;
  disconnect(): Promise<void>;
  loadPlayback?(playback: ResolvedPlaybackSource, positionSeconds?: number): Promise<void>;
  send(command: MediaSessionCommand): Promise<void>;
  getState(): Promise<MediaSessionState | null>;
}
export interface CastingManager {
  discover(): Promise<PlaybackTarget[]>;
  connect(target: PlaybackTarget): Promise<void>;
  disconnect(): Promise<void>;
  loadPlayback(playback: ResolvedPlaybackSource, positionSeconds?: number): Promise<void>;
  send(command: MediaSessionCommand): Promise<void>;
  getState(): Promise<MediaSessionState | null>;
  subscribeState(listener: (state: MediaSessionState) => void, intervalMs?: number): () => void;
  dispose(): void;
}

export function buildTransferCommand(target: PlaybackTarget): MediaSessionCommand { return { type: 'transfer', target }; }

export function createCastingManager(controllers: MediaSessionController[], initialState: MediaSessionState): CastingManager {
  let active: MediaSessionController | null = null;
  let state = initialState;
  let connectionGeneration = 0;
  let disposed = false;
  let observationGeneration = 0;
  const assertActive = () => { if (disposed) throw new Error('Casting manager is disposed.'); };
  return {
    discover() { assertActive(); return Promise.all(controllers.map((controller) => controller.discoverTargets().catch(() => []))).then((groups) => { assertActive(); return groups.flat(); }); },
    async connect(target) {
      assertActive();
      const controller = controllers.find((candidate) => candidate.transport === target.transport);
      if (!controller) throw new Error(`No ${target.transport} controller is available.`);
      const generation = ++connectionGeneration;
      ++observationGeneration;
      await controller.connect(target);
      if (disposed || generation !== connectionGeneration) {
        await controller.disconnect().catch(() => undefined);
        throw new Error('TV playback connection was superseded.');
      }
      active = controller;
      state = { ...state, target };
    },
    async disconnect() {
      if (disposed) return;
      ++connectionGeneration;
      ++observationGeneration;
      const controller = active;
      active = null;
      if (controller) await controller.disconnect();
      state = { ...state, target: undefined };
    },
    async loadPlayback(playback, positionSeconds = 0) {
      assertActive();
      const controller = active;
      if (!controller?.loadPlayback) throw new Error('Active remote playback controller cannot load a new source.');
      const generation = connectionGeneration;
      await controller.loadPlayback(playback, Math.max(0, positionSeconds));
      if (disposed || controller !== active || generation !== connectionGeneration) return;
      state = { ...state, titleId: playback.source.titleId, sourceUrl: playback.source.url, positionSeconds: Math.max(0, positionSeconds), playing: false };
    },
    async send(command) {
      assertActive();
      const controller = active;
      if (!controller) throw new Error('No TV playback session is connected.');
      const generation = connectionGeneration;
      await controller.send(command);
      if (disposed || controller !== active || generation !== connectionGeneration) return;
      if (command.type === 'transfer' && command.target) state = { ...state, target: command.target };
    },
    async getState() {
      assertActive();
      const controller = active;
      if (!controller) return state;
      const generation = connectionGeneration;
      const next = await controller.getState();
      if (disposed || controller !== active || generation !== connectionGeneration) return state;
      return next ?? state;
    },
    subscribeState(listener, intervalMs = 500) {
      assertActive();
      let stopped = false;
      const generation = connectionGeneration;
      const observation = ++observationGeneration;
      const controller = active;
      let pollSequence = 0;
      let appliedSequence = 0;
      const tick = async () => {
        if (disposed || stopped || !controller || controller !== active || generation !== connectionGeneration || observation !== observationGeneration) return;
        const sequence = ++pollSequence;
        const next = await controller.getState().catch(() => null);
        if (disposed || stopped || controller !== active || generation !== connectionGeneration || observation !== observationGeneration || sequence < appliedSequence || !next) return;
        appliedSequence = sequence;
        state = { ...state, ...next };
        listener(state);
      };
      const timer = globalThis.setInterval(tick, intervalMs);
      void tick();
      return () => { stopped = true; ++observationGeneration; globalThis.clearInterval(timer); };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      ++connectionGeneration;
      ++observationGeneration;
      const controller = active;
      active = null;
      if (controller) void controller.disconnect().catch(() => undefined);
      state = { ...state, target: undefined };
    },
  };
}

export function assertCastableSource(sourceUrl: string): string { if (!sourceUrl.startsWith('https://')) throw new Error('JhadinaTV casting requires an HTTPS media source.'); return sourceUrl; }

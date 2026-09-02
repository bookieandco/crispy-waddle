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
}

export function buildTransferCommand(target: PlaybackTarget): MediaSessionCommand { return { type: 'transfer', target }; }

export function createCastingManager(controllers: MediaSessionController[], initialState: MediaSessionState): CastingManager {
  let active: MediaSessionController | null = null;
  let state = initialState;
  let connectionGeneration = 0;
  return {
    discover() { return Promise.all(controllers.map((controller) => controller.discoverTargets().catch(() => []))).then((groups) => groups.flat()); },
    async connect(target) {
      const controller = controllers.find((candidate) => candidate.transport === target.transport);
      if (!controller) throw new Error(`No ${target.transport} controller is available.`);
      const generation = ++connectionGeneration;
      await controller.connect(target);
      if (generation !== connectionGeneration) {
        await controller.disconnect().catch(() => undefined);
        throw new Error('TV playback connection was superseded.');
      }
      active = controller;
      state = { ...state, target };
    },
    async disconnect() {
      ++connectionGeneration;
      const controller = active;
      active = null;
      if (controller) await controller.disconnect();
      state = { ...state, target: undefined };
    },
    async loadPlayback(playback, positionSeconds = 0) {
      const controller = active;
      if (!controller?.loadPlayback) throw new Error('Active remote playback controller cannot load a new source.');
      await controller.loadPlayback(playback, Math.max(0, positionSeconds));
      if (controller !== active) return;
      state = {
        ...state,
        titleId: playback.source.titleId,
        sourceUrl: playback.source.url,
        positionSeconds: Math.max(0, positionSeconds),
        playing: false,
      };
    },
    async send(command) {
      const controller = active;
      if (!controller) throw new Error('No TV playback session is connected.');
      await controller.send(command);
      if (controller !== active) return;
      if (command.type === 'transfer' && command.target) state = { ...state, target: command.target };
    },
    async getState() {
      const controller = active;
      if (!controller) return state;
      return (await controller.getState()) ?? state;
    },
    subscribeState(listener, intervalMs = 500) {
      let stopped = false;
      const generation = connectionGeneration;
      const controller = active;
      const tick = async () => {
        if (stopped || !controller || controller !== active || generation !== connectionGeneration) return;
        const next = await controller.getState().catch(() => null);
        if (stopped || controller !== active || generation !== connectionGeneration || !next) return;
        state = { ...state, ...next };
        listener(state);
      };
      const timer = globalThis.setInterval(tick, intervalMs);
      void tick();
      return () => { stopped = true; globalThis.clearInterval(timer); };
    },
  };
}

export function assertCastableSource(sourceUrl: string): string { if (!sourceUrl.startsWith('https://')) throw new Error('JhadinaTV casting requires an HTTPS media source.'); return sourceUrl; }

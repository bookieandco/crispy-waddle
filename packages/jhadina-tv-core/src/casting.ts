import type { MediaKind } from './index';

export type PlaybackTransport = 'local' | 'airplay' | 'google-cast' | 'jhadinatv-tv';

export interface PlaybackTarget { id: string; name: string; transport: PlaybackTransport; }
export interface MediaSessionState { titleId: string; kind: MediaKind; sourceUrl: string; positionSeconds: number; durationSeconds?: number; playing: boolean; volume?: number; target?: PlaybackTarget; }
export interface MediaSessionCommand { type: 'play' | 'pause' | 'seek' | 'set-volume' | 'transfer'; value?: number; target?: PlaybackTarget; }
export interface MediaSessionController {
  readonly transport: PlaybackTransport;
  discoverTargets(): Promise<PlaybackTarget[]>;
  connect(target: PlaybackTarget): Promise<void>;
  disconnect(): Promise<void>;
  send(command: MediaSessionCommand): Promise<void>;
  getState(): Promise<MediaSessionState | null>;
}
export interface CastingManager {
  discover(): Promise<PlaybackTarget[]>;
  connect(target: PlaybackTarget): Promise<void>;
  disconnect(): Promise<void>;
  send(command: MediaSessionCommand): Promise<void>;
  getState(): Promise<MediaSessionState | null>;
  subscribeState(listener: (state: MediaSessionState) => void, intervalMs?: number): () => void;
}

export function buildTransferCommand(target: PlaybackTarget): MediaSessionCommand { return { type: 'transfer', target }; }

export function createCastingManager(controllers: MediaSessionController[], initialState: MediaSessionState): CastingManager {
  let active: MediaSessionController | null = null;
  let state = initialState;
  return {
    async discover() { const groups = await Promise.all(controllers.map((controller) => controller.discoverTargets().catch(() => []))); return groups.flat(); },
    async connect(target) {
      const controller = controllers.find((candidate) => candidate.transport === target.transport);
      if (!controller) throw new Error(`No ${target.transport} controller is available.`);
      await controller.connect(target); active = controller; state = { ...state, target };
    },
    async disconnect() { if (active) await active.disconnect(); active = null; state = { ...state, target: undefined }; },
    async send(command) { if (!active) throw new Error('No TV playback session is connected.'); await active.send(command); state = { ...state, ...(command.type === 'transfer' && command.target ? { target: command.target } : {}) }; },
    async getState() { return active ? (await active.getState()) ?? state : state; },
    subscribeState(listener, intervalMs = 500) {
      let stopped = false;
      const tick = async () => { if (stopped || !active) return; const next = await active.getState().catch(() => null); if (next) { state = { ...state, ...next }; listener(state); } };
      const timer = globalThis.setInterval(tick, intervalMs);
      void tick();
      return () => { stopped = true; globalThis.clearInterval(timer); };
    },
  };
}

export function assertCastableSource(sourceUrl: string): string { if (!sourceUrl.startsWith('https://')) throw new Error('JhadinaTV casting requires an HTTPS media source.'); return sourceUrl; }

import type { WatchSession, WatchSource } from './watch-session.js';

export type WatchObservation = {
  sourceId: string;
  startSeconds: number;
  endSeconds: number;
  modality: 'vision' | 'audio' | 'transcript';
  type: string;
  label?: string;
  confidence?: number;
  metadata?: Record<string, unknown>;
};

export type WatchService = {
  open(source: WatchSource): Promise<WatchSession>;
  observe(session: WatchSession, observations: WatchObservation[]): Promise<void>;
};

const SUPPORTED_KINDS = new Set<WatchSource['kind']>(['local-file', 'hls', 'dash', 'rtsp', 'capture', 'authorized-stream']);

export function createWatchService(deps: { createSession: (source: WatchSource) => WatchSession; onObservations?: (items: WatchObservation[]) => Promise<void> }): WatchService {
  return {
    async open(source) {
      if (!SUPPORTED_KINDS.has(source.kind)) throw new Error(`Unsupported watch source: ${source.kind}`);
      if (!source.url.trim()) throw new Error('Watch source URL/path is required.');
      return deps.createSession(source);
    },
    async observe(_session, observations) {
      if (observations.length === 0 || !deps.onObservations) return;
      await deps.onObservations(observations);
    },
  };
}

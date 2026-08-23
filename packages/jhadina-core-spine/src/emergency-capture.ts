import type { EvidenceMediaKind } from './emergency-evidence.js';

export interface CaptureChunk {
  readonly sessionId: string;
  readonly sequence: number;
  readonly mediaKind: EvidenceMediaKind;
  readonly capturedAt: string;
  readonly content: Uint8Array;
}

export interface CaptureSourceCapabilities {
  readonly audio: boolean;
  readonly video: boolean;
  readonly location: boolean;
  readonly backgroundCapture: boolean;
}

export interface CaptureAdapter {
  capabilities(): Promise<CaptureSourceCapabilities>;
  start(sessionId: string): Promise<void>;
  stop(sessionId: string): Promise<void>;
  /** Returns encrypted-ready chunks; adapters must not persist plaintext beyond platform requirements. */
  readChunks(sessionId: string): AsyncIterable<CaptureChunk>;
}

export interface CaptureAdapterPolicy {
  readonly requireOffDevicePersistence: boolean;
  readonly allowLocalQueueWhenOffline: boolean;
  readonly maxLocalQueueSeconds: number;
}

/**
 * Platform-neutral boundary for the black box. Implementations must respect
 * OS permissions and foreground/background capture restrictions and must never
 * claim a capability the device/runtime has not actually granted.
 */
export interface BlackBoxCaptureAdapter {
  readonly policy: CaptureAdapterPolicy;
  readonly source: CaptureAdapter;
}

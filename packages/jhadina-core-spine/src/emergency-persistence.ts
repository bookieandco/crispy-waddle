import type { CaptureChunk } from './emergency-capture.js';

export interface PersistedChunk {
  readonly sessionId: string;
  readonly sequence: number;
  readonly contentHash: string;
  readonly previousChunkHash?: string;
  readonly persistedAt: string;
}

export interface EvidencePersistenceResult {
  readonly persisted: PersistedChunk;
  readonly offDevice: boolean;
}

export interface EvidencePersistenceAdapter {
  persist(chunk: CaptureChunk): Promise<EvidencePersistenceResult>;
  flush(sessionId: string): Promise<readonly PersistedChunk[]>;
  pending(sessionId: string): Promise<readonly CaptureChunk[]>;
}

export interface EvidencePersistencePolicy {
  readonly requireEncryptionAtRest: boolean;
  readonly requireOffDeviceCopy: boolean;
  readonly allowOfflineQueue: boolean;
  readonly maxOfflineSeconds: number;
  readonly maxRetryAttempts: number;
}

export interface EvidenceIntegrityRecord {
  readonly sessionId: string;
  readonly sequence: number;
  readonly contentHash: string;
  readonly previousChunkHash?: string;
  readonly algorithm: 'sha-256';
}

/**
 * Persistence is intentionally separate from capture and release.
 * Implementations are responsible for encrypted storage and retry behavior;
 * the core contract does not prescribe a cloud provider.
 */
export interface BlackBoxPersistence {
  readonly policy: EvidencePersistencePolicy;
  readonly adapter: EvidencePersistenceAdapter;
}

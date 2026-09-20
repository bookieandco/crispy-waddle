export interface EncryptedEvidenceChunk {
  readonly id: string;
  readonly incidentId: string;
  readonly sequence: number;
  readonly ciphertextRef: string;
  readonly contentHash: string;
  readonly previousChunkHash?: string;
  readonly persistedLocally: boolean;
  readonly persistedOffDevice: boolean;
}

export interface BlackBoxQueueReceipt {
  readonly chunkId: string;
  readonly state: 'queued' | 'off-device-confirmed' | 'retry-required';
  readonly attempt: number;
}

export interface SafetyBlackBoxStore {
  persistEncrypted(chunk: EncryptedEvidenceChunk): Promise<BlackBoxQueueReceipt>;
  retryPending(incidentId: string): Promise<readonly BlackBoxQueueReceipt[]>;
  verifyOffDevice(chunkId: string): Promise<boolean>;
}

export function assertBlackBoxChain(chunks: readonly EncryptedEvidenceChunk[]): void {
  const ordered = chunks.slice().sort((a, b) => a.sequence - b.sequence);
  for (let index = 1; index < ordered.length; index += 1) {
    if (ordered[index].previousChunkHash !== ordered[index - 1].contentHash) {
      throw new Error('Black-box evidence chain broken');
    }
  }
}

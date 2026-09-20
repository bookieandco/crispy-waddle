import type { EncryptedEvidenceChunk } from './safety-blackbox-runtime.js';

export interface VaultChunkReceipt {
  readonly chunkId: string;
  readonly accepted: boolean;
  readonly remoteRef?: string;
  readonly verifiedHash?: string;
}

export interface SafetyEvidenceVault {
  upload(chunk: EncryptedEvidenceChunk): Promise<VaultChunkReceipt>;
  verify(chunkId: string, expectedHash: string): Promise<boolean>;
}

export interface SafetyVaultManifest {
  readonly incidentId: string;
  readonly confirmedChunkIds: readonly string[];
  readonly pendingChunkIds: readonly string[];
}

export async function reconcileEvidenceVault(
  chunks: readonly EncryptedEvidenceChunk[],
  vault: SafetyEvidenceVault,
): Promise<SafetyVaultManifest> {
  const confirmed: string[] = [];
  const pending: string[] = [];
  for (const chunk of chunks.slice().sort((a, b) => a.sequence - b.sequence)) {
    const receipt = await vault.upload(chunk);
    const verified = receipt.accepted && await vault.verify(chunk.id, chunk.contentHash);
    (verified ? confirmed : pending).push(chunk.id);
  }
  return {
    incidentId: chunks[0]?.incidentId ?? '',
    confirmedChunkIds: confirmed,
    pendingChunkIds: pending,
  };
}

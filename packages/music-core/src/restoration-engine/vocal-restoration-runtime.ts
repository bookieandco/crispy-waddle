import {
  createVocalRestorationResult,
  validateVocalRestorationRequest,
  type VocalRepairSegment,
  type VocalRestorationRequest,
  type VocalRestorationResult,
} from "../vocal-restoration.js";
import {
  sha256Hex,
  type RestorationArtifactStore,
  type StoredRestorationArtifact,
} from "./ingest-runtime.js";
import type {
  RestorationRuntimeClient,
  RestorationRuntimeSource,
  RestorationVocalRepairReceipt,
  RestorationVocalRepairSegment,
} from "./runtime-contract.js";

function safeFilePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "vocal-restoration";
}

function isVocalRole(role?: string): boolean {
  return role === "vocals" || role === "vocal-restoration" || Boolean(role?.startsWith("vocal-"));
}

function normalizedSegment(segment: VocalRepairSegment): RestorationVocalRepairSegment {
  const duration = segment.endMs - segment.startMs;
  return {
    startMs: segment.startMs,
    endMs: segment.endMs,
    operation: segment.operation,
    parameters: { ...(segment.parameters ?? {}) },
    sourceResidualMix: segment.sourceResidualMix ?? 0.08,
    fadeMs: segment.fadeMs ?? Math.min(20, duration / 4),
  };
}

async function runtimeSource(
  store: RestorationArtifactStore,
  ownerUserId: string,
  artifact: StoredRestorationArtifact,
): Promise<RestorationRuntimeSource> {
  return {
    artifactId: artifact.id,
    uri: await store.resolveRuntimeUri(ownerUserId, artifact.id),
    sha256: artifact.contentHash,
    mimeType: artifact.mimeType,
  };
}

export interface VocalRestorationRuntimeResult extends VocalRestorationResult {
  storedArtifact: StoredRestorationArtifact;
  runtimeReceipt: RestorationVocalRepairReceipt;
}

/**
 * MUSIC-RESTORE.6 deterministic vocal restoration boundary.
 *
 * Operates only on a persisted vocal artifact. The worker may alter only
 * declared regions with allow-listed correction operations. The returned WAV
 * is independently re-hashed and rejected if signal geometry or conservative
 * vocal-identity preservation checks fail.
 */
export async function restoreVocalRegions(input: {
  ownerUserId: string;
  caseId: string;
  request: VocalRestorationRequest;
  source: StoredRestorationArtifact;
  runtime: RestorationRuntimeClient;
  store: RestorationArtifactStore;
  jobId?: string;
  now?: string;
}): Promise<VocalRestorationRuntimeResult> {
  validateVocalRestorationRequest(input.request, { ownerUserId: input.ownerUserId });

  const { source, request } = input;
  if (source.id !== request.sourceArtifactId) {
    throw new Error("MUSIC_VOCAL_RESTORATION_ARTIFACT_REQUEST_MISMATCH");
  }
  if (source.ownerUserId !== input.ownerUserId || source.caseId !== input.caseId) {
    throw new Error("MUSIC_VOCAL_RESTORATION_ARTIFACT_SCOPE_MISMATCH");
  }
  if (!isVocalRole(source.role)) {
    throw new Error("MUSIC_VOCAL_RESTORATION_VOCAL_STEM_REQUIRED");
  }

  const jobId = input.jobId?.trim() || `music-vocal-restore:${globalThis.crypto.randomUUID()}`;
  if (!input.runtime.restoreVocal) {
    throw new Error("MUSIC_VOCAL_RESTORATION_RUNTIME_UNAVAILABLE");
  }
  const receipt = await input.runtime.restoreVocal({
    jobId,
    requestId: request.requestId,
    authorizationId: request.approval.evidenceId,
    source: await runtimeSource(input.store, input.ownerUserId, source),
    segments: request.segments.map(normalizedSegment),
    sampleRate: source.sampleRate,
    channels: source.channels,
  });

  if (receipt.sampleRate !== source.sampleRate || receipt.channels !== source.channels) {
    throw new Error("MUSIC_VOCAL_RESTORATION_OUTPUT_DIMENSIONS_MISMATCH");
  }
  const sampleTolerance = Math.max(2, Math.round(source.sampleCount * 0.002));
  if (Math.abs(receipt.sampleCount - source.sampleCount) > sampleTolerance) {
    throw new Error("MUSIC_VOCAL_RESTORATION_OUTPUT_DURATION_MISMATCH");
  }
  if (!receipt.preservation.passed) {
    throw new Error(
      `MUSIC_VOCAL_RESTORATION_IDENTITY_DRIFT: ${receipt.preservation.reasons.join("; ")}`,
    );
  }

  const bytes = await input.runtime.downloadArtifact(receipt.resultUri);
  if (!bytes.byteLength) throw new Error("MUSIC_VOCAL_RESTORATION_OUTPUT_EMPTY");
  const actualHash = await sha256Hex(bytes);
  if (actualHash.toLowerCase() !== receipt.outputSha256.toLowerCase()) {
    throw new Error("MUSIC_VOCAL_RESTORATION_OUTPUT_HASH_MISMATCH");
  }

  const stored = await input.store.putDerived({
    ownerUserId: input.ownerUserId,
    caseId: input.caseId,
    artifactId: receipt.outputArtifactId,
    parentArtifactId: source.id,
    fileName: `${safeFilePart(request.requestId)}.wav`,
    mimeType: "audio/wav",
    sha256: actualHash,
    bytes,
    role: "vocal-restoration",
  });
  const now = input.now ?? new Date().toISOString();
  const artifact: StoredRestorationArtifact = {
    id: receipt.outputArtifactId,
    kind: "derived",
    contentHash: actualHash,
    sampleRate: receipt.sampleRate,
    channels: receipt.channels,
    sampleCount: receipt.sampleCount,
    parentArtifactId: source.id,
    createdAt: now,
    ownerUserId: input.ownerUserId,
    caseId: input.caseId,
    storageUri: stored.storageUri,
    mimeType: "audio/wav",
    sizeBytes: bytes.byteLength,
    role: "vocal-restoration",
    runtimeReceiptId: receipt.runtimeReceiptId,
  };
  await input.store.register(artifact);

  const result = createVocalRestorationResult(
    request,
    {
      artifactId: artifact.id,
      sourceArtifactId: source.id,
      requestId: request.requestId,
      sha256: actualHash,
      createdAt: now,
    },
    receipt.preservation,
  );

  return {
    ...result,
    storedArtifact: artifact,
    runtimeReceipt: receipt,
  };
}

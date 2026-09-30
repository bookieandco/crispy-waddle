import {
  createReconstructionResult,
  validateReconstructionRequest,
  type InstrumentReconstructionRequest,
  type ReconstructionQcEvidence,
  type ReconstructionResult,
} from "../instrument-reconstruction.js";
import {
  sha256Hex,
  type RestorationArtifactStore,
  type StoredRestorationArtifact,
} from "./ingest-runtime.js";
import type {
  RestorationReconstructionReceipt,
  RestorationReconstructionSegment,
  RestorationRuntimeClient,
  RestorationRuntimeSource,
} from "./runtime-contract.js";

function safeFilePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "reconstruction";
}

function normalizedSegment(
  segment: InstrumentReconstructionRequest["segments"][number],
): RestorationReconstructionSegment {
  const targetDuration = segment.targetEndMs - segment.targetStartMs;
  return {
    targetStartMs: segment.targetStartMs,
    targetEndMs: segment.targetEndMs,
    replacementStartMs: segment.replacementStartMs,
    replacementEndMs: segment.replacementEndMs,
    gainDb: segment.gainDb ?? 0,
    sourceResidualMix: segment.sourceResidualMix ?? 0.05,
    fadeMs: segment.fadeMs ?? Math.min(20, targetDuration / 4),
    phaseInvert: segment.phaseInvert ?? false,
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

export interface InstrumentReconstructionRuntimeResult extends ReconstructionResult {
  storedArtifact: StoredRestorationArtifact;
  runtimeReceipt: RestorationReconstructionReceipt;
}

/**
 * MUSIC-RESTORE.5 real reconstruction boundary.
 *
 * This function does not choose a donor or infer approval. It receives an
 * evidence-admitted, explicitly approved request, binds both durable artifacts
 * to signed runtime URLs, executes a bounded local reconstruction, independently
 * re-hashes the returned WAV, and only then registers the reconstructed artifact.
 */
export async function reconstructInstrumentRegions(input: {
  ownerUserId: string;
  caseId: string;
  request: InstrumentReconstructionRequest;
  source: StoredRestorationArtifact;
  replacement: StoredRestorationArtifact;
  runtime: RestorationRuntimeClient;
  store: RestorationArtifactStore;
  jobId?: string;
  now?: string;
}): Promise<InstrumentReconstructionRuntimeResult> {
  validateReconstructionRequest(input.request, { ownerUserId: input.ownerUserId });

  const { source, replacement, request } = input;
  if (source.id !== request.sourceArtifactId || replacement.id !== request.replacementArtifactId) {
    throw new Error("MUSIC_RECONSTRUCTION_ARTIFACT_REQUEST_MISMATCH");
  }
  for (const artifact of [source, replacement]) {
    if (artifact.ownerUserId !== input.ownerUserId || artifact.caseId !== input.caseId) {
      throw new Error("MUSIC_RECONSTRUCTION_ARTIFACT_SCOPE_MISMATCH");
    }
  }

  const jobId = input.jobId?.trim() || `music-reconstruct:${globalThis.crypto.randomUUID()}`;
  const sourceRuntime = await runtimeSource(input.store, input.ownerUserId, source);
  const replacementRuntime = await runtimeSource(input.store, input.ownerUserId, replacement);
  const receipt = await input.runtime.reconstruct({
    jobId,
    requestId: request.requestId,
    authorizationId: request.approval.evidenceId,
    source: sourceRuntime,
    replacement: replacementRuntime,
    segments: request.segments.map(normalizedSegment),
    sampleRate: source.sampleRate,
    channels: source.channels,
  });

  const bytes = await input.runtime.downloadArtifact(receipt.resultUri);
  const actualHash = await sha256Hex(bytes);
  if (actualHash.toLowerCase() !== receipt.outputSha256.toLowerCase()) {
    throw new Error("MUSIC_RECONSTRUCTION_OUTPUT_HASH_MISMATCH");
  }
  if (receipt.sampleRate !== source.sampleRate || receipt.channels !== source.channels) {
    throw new Error("MUSIC_RECONSTRUCTION_OUTPUT_DIMENSIONS_MISMATCH");
  }

  const sampleTolerance = Math.max(2, Math.round(source.sampleCount * 0.002));
  if (Math.abs(receipt.sampleCount - source.sampleCount) > sampleTolerance) {
    throw new Error("MUSIC_RECONSTRUCTION_OUTPUT_DURATION_MISMATCH");
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
    role: `reconstructed-${request.instrumentFamily}`,
  });
  const now = input.now ?? new Date().toISOString();
  const artifact: StoredRestorationArtifact = {
    id: receipt.outputArtifactId,
    kind: "reconstructed",
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
    role: `reconstructed-${request.instrumentFamily}`,
    runtimeReceiptId: receipt.runtimeReceiptId,
  };
  await input.store.register(artifact);

  const qc: ReconstructionQcEvidence = {
    passed: true,
    method: "hash-dimensions-duration-v1",
    findings: [
      "worker output SHA-256 independently verified",
      "sample rate and channel count preserved",
      "output duration remains within 0.2% of source",
      "localized reconstruction still requires A/B audition before promotion",
    ],
    requiresAudition: true,
  };
  const result = createReconstructionResult(request, {
    artifactId: artifact.id,
    sourceArtifactId: source.id,
    replacementArtifactId: replacement.id,
    requestId: request.requestId,
    status: "rendered",
    sha256: actualHash,
    createdAt: now,
  }, qc);

  return {
    ...result,
    storedArtifact: artifact,
    runtimeReceipt: receipt,
  };
}

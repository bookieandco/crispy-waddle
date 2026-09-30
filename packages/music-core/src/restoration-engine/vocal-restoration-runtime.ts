import {
  validateVocalRestorationRequest,
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
} from "./runtime-contract.js";

export interface VocalRestorationRuntimeResult extends VocalRestorationResult {
  storedArtifact: StoredRestorationArtifact;
  runtimeReceipt: RestorationVocalRepairReceipt;
}

function safeFilePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "vocal-restoration";
}

export async function restoreVocalArtifact(input: {
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
  if (input.source.id !== input.request.sourceArtifactId) {
    throw new Error("MUSIC_VOCAL_RESTORATION_ARTIFACT_REQUEST_MISMATCH");
  }
  if (input.source.ownerUserId !== input.ownerUserId || input.source.caseId !== input.caseId) {
    throw new Error("MUSIC_VOCAL_RESTORATION_ARTIFACT_SCOPE_MISMATCH");
  }
  if (input.source.role !== "vocals") {
    throw new Error("MUSIC_VOCAL_RESTORATION_VOCAL_STEM_REQUIRED");
  }
  if (!input.runtime.restoreVocal) {
    throw new Error("MUSIC_VOCAL_RESTORATION_RUNTIME_UNAVAILABLE");
  }

  const sourceRuntime: RestorationRuntimeSource = {
    artifactId: input.source.id,
    uri: await input.store.resolveRuntimeUri(input.ownerUserId, input.source.id),
    sha256: input.source.contentHash,
    mimeType: input.source.mimeType,
  };
  const jobId = input.jobId?.trim() || `music-vocal:${globalThis.crypto.randomUUID()}`;
  const receipt = await input.runtime.restoreVocal({
    jobId,
    requestId: input.request.requestId,
    authorizationId: input.request.approval.evidenceId,
    source: sourceRuntime,
    profile: input.request.profile,
    sampleRate: input.source.sampleRate,
    channels: input.source.channels,
  });

  if (!receipt.comparison.identityPreserved) {
    throw new Error(
      `MUSIC_VOCAL_RESTORATION_IDENTITY_QC_FAILED: ${receipt.comparison.reasons.join("; ")}`,
    );
  }
  if (receipt.sampleRate !== input.source.sampleRate || receipt.channels !== input.source.channels) {
    throw new Error("MUSIC_VOCAL_RESTORATION_OUTPUT_DIMENSIONS_MISMATCH");
  }
  const sampleTolerance = Math.max(2, Math.round(input.source.sampleCount * 0.002));
  if (Math.abs(receipt.sampleCount - input.source.sampleCount) > sampleTolerance) {
    throw new Error("MUSIC_VOCAL_RESTORATION_OUTPUT_DURATION_MISMATCH");
  }

  const bytes = await input.runtime.downloadArtifact(receipt.resultUri);
  if (!bytes.byteLength) throw new Error("MUSIC_VOCAL_RESTORATION_OUTPUT_EMPTY");
  const actualHash = await sha256Hex(bytes);
  if (actualHash.toLowerCase() !== receipt.outputSha256.toLowerCase()) {
    throw new Error("MUSIC_VOCAL_RESTORATION_OUTPUT_HASH_MISMATCH");
  }
  const existing = await input.store.get(input.ownerUserId, receipt.outputArtifactId);
  if (existing) throw new Error(`MUSIC_VOCAL_RESTORATION_OUTPUT_ALREADY_EXISTS: ${receipt.outputArtifactId}`);

  const stored = await input.store.putDerived({
    ownerUserId: input.ownerUserId,
    caseId: input.caseId,
    artifactId: receipt.outputArtifactId,
    parentArtifactId: input.source.id,
    fileName: `${safeFilePart(input.request.requestId)}.wav`,
    mimeType: "audio/wav",
    sha256: actualHash,
    bytes,
    role: "vocals",
  });
  const now = input.now ?? new Date().toISOString();
  const artifact: StoredRestorationArtifact = {
    id: receipt.outputArtifactId,
    kind: "derived",
    contentHash: actualHash,
    sampleRate: receipt.sampleRate,
    channels: receipt.channels,
    sampleCount: receipt.sampleCount,
    parentArtifactId: input.source.id,
    createdAt: now,
    ownerUserId: input.ownerUserId,
    caseId: input.caseId,
    storageUri: stored.storageUri,
    mimeType: "audio/wav",
    sizeBytes: bytes.byteLength,
    role: "vocals",
    runtimeReceiptId: receipt.runtimeReceiptId,
  };
  await input.store.register(artifact);

  return {
    requestId: input.request.requestId,
    sourceArtifactId: input.source.id,
    outputArtifactId: artifact.id,
    status: "rendered",
    qc: {
      passed: true,
      identityPreserved: true,
      method: "vocal-identity-preservation-v1",
      findings: [
        "worker output SHA-256 independently verified",
        "sample rate and channel count preserved",
        "output duration remains within 0.2% of source",
        "median F0, F0 variation, voicing, timbre proxy and RMS drift passed conservative bounds",
      ],
      requiresAudition: true,
    },
    createdAt: now,
    storedArtifact: artifact,
    runtimeReceipt: receipt,
  };
}

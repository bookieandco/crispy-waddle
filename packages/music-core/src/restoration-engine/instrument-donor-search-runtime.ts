import {
  instrumentDonorSourceRoleAllowed,
  validateInstrumentDonorSearchInput,
  type InstrumentDonorCandidate,
  type InstrumentDonorSearchInput,
} from "../instrument-donor-search.js";
import {
  sha256Hex,
  type RestorationArtifactStore,
  type StoredRestorationArtifact,
} from "./ingest-runtime.js";
import type {
  RestorationDonorSearchReceipt,
  RestorationRuntimeClient,
  RestorationRuntimeSource,
} from "./runtime-contract.js";

export interface StoredInstrumentDonorCandidate extends InstrumentDonorCandidate {
  artifact: StoredRestorationArtifact;
}

export interface InstrumentDonorSearchRuntimeResult {
  jobId: string;
  sourceArtifactId: string;
  runtimeReceiptId: string;
  candidates: StoredInstrumentDonorCandidate[];
  receipt: RestorationDonorSearchReceipt;
}

function safeFilePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "donor";
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

/**
 * Same-recording donor discovery.
 *
 * Search is descriptive only. It materializes ranked candidate clips as
 * provenance-bound derived artifacts. No candidate is authorized for
 * reconstruction until the existing MUSIC-RESTORE.5 assessment + explicit
 * human approval path accepts it.
 */
export async function searchAndPersistInstrumentDonors(input: {
  ownerUserId: string;
  caseId: string;
  source: StoredRestorationArtifact;
  search: InstrumentDonorSearchInput;
  runtime: RestorationRuntimeClient;
  store: RestorationArtifactStore;
  jobId?: string;
  now?: string;
}): Promise<InstrumentDonorSearchRuntimeResult> {
  validateInstrumentDonorSearchInput(input.search);
  if (input.source.id !== input.search.sourceArtifactId) {
    throw new Error("MUSIC_DONOR_SEARCH_ARTIFACT_REQUEST_MISMATCH");
  }
  if (input.source.ownerUserId !== input.ownerUserId || input.source.caseId !== input.caseId) {
    throw new Error("MUSIC_DONOR_SEARCH_ARTIFACT_SCOPE_MISMATCH");
  }
  if (!instrumentDonorSourceRoleAllowed(input.source.role, input.search.instrumentFamily)) {
    throw new Error("MUSIC_DONOR_SEARCH_SOURCE_ROLE_NOT_ADMITTED");
  }
  if (!input.runtime.searchDonors) {
    throw new Error("MUSIC_DONOR_SEARCH_RUNTIME_UNAVAILABLE");
  }

  const jobId = input.jobId?.trim() || `music-donor-search:${globalThis.crypto.randomUUID()}`;
  const receipt = await input.runtime.searchDonors({
    jobId,
    source: await runtimeSource(input.store, input.ownerUserId, input.source),
    instrumentFamily: input.search.instrumentFamily,
    eventKind: input.search.eventKind,
    targetStartMs: input.search.target.startMs,
    targetEndMs: input.search.target.endMs,
    maxCandidates: input.search.maxCandidates ?? 3,
  });

  const now = input.now ?? new Date().toISOString();
  const candidates: StoredInstrumentDonorCandidate[] = [];
  for (const candidate of receipt.candidates) {
    if (candidate.parentArtifactId !== input.source.id) {
      throw new Error("MUSIC_DONOR_SEARCH_CANDIDATE_LINEAGE_MISMATCH");
    }
    const bytes = await input.runtime.downloadArtifact(candidate.resultUri);
    if (!bytes.byteLength) throw new Error("MUSIC_DONOR_SEARCH_CANDIDATE_EMPTY");
    const actualHash = await sha256Hex(bytes);
    if (actualHash.toLowerCase() !== candidate.sha256.toLowerCase()) {
      throw new Error("MUSIC_DONOR_SEARCH_CANDIDATE_HASH_MISMATCH");
    }
    const existing = await input.store.get(input.ownerUserId, candidate.artifactId);
    if (existing) throw new Error(`MUSIC_DONOR_SEARCH_CANDIDATE_EXISTS: ${candidate.artifactId}`);

    const stored = await input.store.putDerived({
      ownerUserId: input.ownerUserId,
      caseId: input.caseId,
      artifactId: candidate.artifactId,
      parentArtifactId: input.source.id,
      fileName: `${safeFilePart(candidate.candidateId)}.wav`,
      mimeType: "audio/wav",
      sha256: actualHash,
      bytes,
      role: `donor-candidate-${input.search.instrumentFamily}`,
    });
    const artifact: StoredRestorationArtifact = {
      id: candidate.artifactId,
      kind: "derived",
      contentHash: actualHash,
      sampleRate: candidate.sampleRate,
      channels: candidate.channels,
      sampleCount: candidate.sampleCount,
      parentArtifactId: input.source.id,
      createdAt: now,
      ownerUserId: input.ownerUserId,
      caseId: input.caseId,
      storageUri: stored.storageUri,
      mimeType: "audio/wav",
      sizeBytes: bytes.byteLength,
      role: `donor-candidate-${input.search.instrumentFamily}`,
      runtimeReceiptId: candidate.runtimeReceiptId,
    };
    await input.store.register(artifact);
    candidates.push({
      candidateId: candidate.candidateId,
      artifactId: artifact.id,
      sourceArtifactId: input.source.id,
      sourceStartMs: candidate.sourceStartMs,
      sourceEndMs: candidate.sourceEndMs,
      similarityScore: candidate.similarityScore,
      qualityScore: candidate.qualityScore,
      contextScore: candidate.contextScore,
      searchScore: candidate.searchScore,
      damageScore: candidate.damageScore,
      expectedGain: candidate.expectedGain,
      runtimeReceiptId: candidate.runtimeReceiptId,
      artifact,
    });
  }

  return {
    jobId,
    sourceArtifactId: input.source.id,
    runtimeReceiptId: receipt.runtimeReceiptId,
    candidates,
    receipt,
  };
}

import { inspectRestorationWav } from "./wav-integrity.js";
import { buildDeepStemDecomposition, type DeepStemDecomposition, type DeepStemNode } from "./deep-stem-decomposition.js";
import { sha256Hex, type RestorationArtifactStore, type StoredRestorationArtifact } from "./ingest-runtime.js";
import type { RestorationRuntimeClient, RestorationRuntimeSource, RestorationStemRole } from "./runtime-contract.js";

export interface RestorationSeparationResult {
  jobId: string;
  sourceArtifactId: string;
  artifacts: StoredRestorationArtifact[];
  decomposition: DeepStemDecomposition;
  runtimeReceiptId: string;
}

function validateRole(role: RestorationStemRole): void {
  if (!["vocals", "drums", "bass", "other", "unknown"].includes(role)) {
    throw new Error(`Unsupported separated stem role: ${role}`);
  }
}

function stemFileName(role: RestorationStemRole): string {
  return `${role}.wav`;
}

/**
 * MUSIC-RESTORE.2 runtime bridge.
 *
 * The worker performs real separation; this bridge independently downloads,
 * re-hashes and durably registers every stem before it can enter the evidence
 * graph. Runtime output never becomes canonical source truth.
 */
export async function separateRestorationSource(input: {
  ownerUserId: string;
  caseId: string;
  source: StoredRestorationArtifact;
  runtime: RestorationRuntimeClient;
  store: RestorationArtifactStore;
  jobId: string;
  modelId?: string;
  now?: string;
}): Promise<RestorationSeparationResult> {
  if (input.source.kind !== "source" && input.source.kind !== "derived") {
    throw new Error("Only source or derived audio artifacts may be separated.");
  }
  if (input.source.ownerUserId !== input.ownerUserId || input.source.caseId !== input.caseId) {
    throw new Error("Separation source ownership/case mismatch.");
  }
  if (!input.jobId.trim()) throw new Error("Separation job id is required.");

  const runtimeUri = await input.store.resolveRuntimeUri(input.ownerUserId, input.source.id);
  const runtimeSource: RestorationRuntimeSource = {
    artifactId: input.source.id,
    uri: runtimeUri,
    sha256: input.source.contentHash,
    mimeType: input.source.mimeType,
  };
  const receipt = await input.runtime.separate({
    jobId: input.jobId,
    source: runtimeSource,
    modelId: input.modelId,
  });

  // All four byte-bound stems must be admitted before the first durable write.
  // This cannot make an external object store/SQL write atomic; infrastructure
  // transaction/compensation remains a commissioning gate.
  const roles = ["vocals","drums","bass","other"] as const;
  if (receipt.jobId !== input.jobId || receipt.sourceArtifactId !== input.source.id ||
      receipt.sourceSha256?.toLowerCase() !== input.source.contentHash.toLowerCase() ||
      !receipt.runtimeReceiptId?.trim() || receipt.stems.length !== roles.length) {
    throw new Error("MUSIC_SEPARATION_RECEIPT_SCOPE_OR_ROLE_COUNT_INVALID");
  }
  const seenRoles = new Set<string>(), seenArtifacts = new Set<string>();
  const prepared: Array<{stem:typeof receipt.stems[number];bytes:Uint8Array;actualSha256:string}> = [];
  for (const stem of receipt.stems) {
    validateRole(stem.role);
    if (!roles.includes(stem.role as typeof roles[number]) ||
        seenRoles.has(stem.role) || seenArtifacts.has(stem.artifactId) ||
        stem.artifactId===input.source.id ||
        stem.parentArtifactId!==input.source.id ||
        !stem.runtimeReceiptId?.trim() ||
        !/^\\/v1\\/jobs\\/[a-zA-Z0-9._-]+\\/artifact\\/[a-zA-Z0-9._-]+\\.wav$/.test(stem.resultUri)) {
      throw new Error("MUSIC_SEPARATION_STEM_RECEIPT_INVALID");
    }
    seenRoles.add(stem.role);seenArtifacts.add(stem.artifactId);
    const bytes = await input.runtime.downloadArtifact(stem.resultUri);
    if (!bytes.byteLength) throw new Error("MUSIC_SEPARATION_STEM_EMPTY");
    const actualSha256 = await sha256Hex(bytes);
    if (actualSha256.toLowerCase() !== stem.sha256.toLowerCase()) {
      throw new Error("MUSIC_SEPARATION_STEM_HASH_MISMATCH");
    }
    const decoded = inspectRestorationWav(bytes);
    if (decoded.sampleRate!==stem.sampleRate || decoded.channels!==stem.channels ||
        decoded.sampleCount!==stem.sampleCount ||
        decoded.sampleRate!==input.source.sampleRate ||
        decoded.sampleCount!==input.source.sampleCount) {
      throw new Error("MUSIC_SEPARATION_STEM_DECODED_TIMEBASE_MISMATCH");
    }
    if (await input.store.get(input.ownerUserId,stem.artifactId)) {
      throw new Error("MUSIC_SEPARATION_STEM_ALREADY_EXISTS");
    }
    prepared.push({stem,bytes,actualSha256});
  }

  const now = input.now ?? new Date().toISOString();
  const artifacts: StoredRestorationArtifact[] = [];
  const nodes: DeepStemNode[] = [{
    id: input.source.id,
    sourceArtifactId: input.source.id,
    kind: "mix",
    label: "canonical mix",
    region: { startSample: 0, endSample: input.source.sampleCount },
    sampleRate: input.source.sampleRate,
    modelId: "canonical-source",
    modelVersion: "1",
    sourceKind: "source-mix",
    confidence: 1,
    evidenceIds: [],
    provenanceIds: [`sha256:${input.source.contentHash}`],
    canonicalSource: true,
  }];

  for (const {stem,bytes,actualSha256} of prepared) {
    const stored = await input.store.putDerived({
      ownerUserId: input.ownerUserId,
      caseId: input.caseId,
      artifactId: stem.artifactId,
      parentArtifactId: input.source.id,
      fileName: stemFileName(stem.role),
      mimeType: "audio/wav",
      sha256: actualSha256,
      bytes,
      role: stem.role,
    });

    const artifact: StoredRestorationArtifact = {
      id: stem.artifactId,
      kind: "derived",
      contentHash: actualSha256,
      sampleRate: stem.sampleRate,
      channels: stem.channels,
      sampleCount: stem.sampleCount,
      parentArtifactId: input.source.id,
      createdAt: now,
      ownerUserId: input.ownerUserId,
      caseId: input.caseId,
      storageUri: stored.storageUri,
      mimeType: "audio/wav",
      sizeBytes: bytes.byteLength,
      role: stem.role,
      runtimeReceiptId: stem.runtimeReceiptId,
    };
    await input.store.register(artifact);
    artifacts.push(artifact);

    nodes.push({
      id: artifact.id,
      sourceArtifactId: input.source.id,
      parentId: input.source.id,
      kind: "stem",
      label: stem.role,
      region: { startSample: 0, endSample: stem.sampleCount },
      sampleRate: stem.sampleRate,
      modelId: stem.modelId,
      modelVersion: stem.modelVersion,
      sourceKind: input.source.kind === "source" ? "separated-stem" : "recursive-separation",
      confidence: stem.confidence,
      bleedEstimate: stem.bleedEstimate,
      evidenceIds: [`separation:${stem.runtimeReceiptId}:${stem.role}`],
      provenanceIds: [
        receipt.runtimeReceiptId,
        stem.runtimeReceiptId,
        `sha256:${stem.sha256}`,
      ],
      canonicalSource: false,
    });
  }

  const decomposition = buildDeepStemDecomposition({
    id: `deep-stems:${receipt.runtimeReceiptId}`,
    sourceArtifactId: input.source.id,
    rootId: input.source.id,
    nodes,
  });
  if (decomposition.abstained) {
    throw new Error(`Separated stem decomposition failed validation: ${decomposition.reasons.join(" ")}`);
  }

  return {
    jobId: receipt.jobId,
    sourceArtifactId: input.source.id,
    artifacts,
    decomposition,
    runtimeReceiptId: receipt.runtimeReceiptId,
  };
}

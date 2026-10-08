import { buildDeepStemDecomposition, type DeepStemDecomposition, type DeepStemNode } from "./deep-stem-decomposition.js";
import { sha256Hex, type RestorationArtifactStore, type StoredRestorationArtifact } from "./ingest-runtime.js";
import type { DeepDrumSeparationReceipt, DrumSubStemRole, RestorationRuntimeClient } from "./runtime-contract.js";

const ROLES: readonly DrumSubStemRole[] = ["kick", "snare", "hihat", "cymbals", "toms", "residual"];
const MAX_STEM_BYTES = 500 * 1024 * 1024;

export interface PersistedDeepDrumsResult {
  jobId: string;
  parentArtifactId: string;
  artifacts: StoredRestorationArtifact[];
  decomposition: DeepStemDecomposition;
  receipt: DeepDrumSeparationReceipt;
}

/**
 * Recursive, authenticated drums -> actual sub-stem audio, not a label-only tree.
 * Caller owns authorization/case permissions; no human restoration approval is inferred.
 */
export async function separateDeepDrumArtifact(input: {
  ownerUserId: string;
  caseId: string;
  parent: StoredRestorationArtifact;
  runtime: RestorationRuntimeClient;
  store: RestorationArtifactStore;
  jobId: string;
  now?: string;
}): Promise<PersistedDeepDrumsResult> {
  const { parent } = input;
  if (parent.ownerUserId !== input.ownerUserId || parent.caseId !== input.caseId ||
      parent.kind !== "derived" || parent.role !== "drums" || !parent.parentArtifactId) {
    throw new Error("Only an authenticated, canonical-parent-bound drums stem may be recursively split.");
  }
  if (!input.jobId.trim()) throw new Error("Deep drum job ID is required.");
  if (!input.runtime.separateDeepDrums) throw new Error("Deep drum model not commissioned.");

  const source = {
    artifactId: parent.id,
    uri: await input.store.resolveRuntimeUri(input.ownerUserId, parent.id),
    sha256: parent.contentHash,
    mimeType: parent.mimeType,
  };
  const receipt = await input.runtime.separateDeepDrums({
    jobId: input.jobId, source, parentRole: "drums", modelId: "drumsep-cpu-v1",
  });
  if (receipt.jobId !== input.jobId ||
      receipt.sourceArtifactId !== parent.id ||
      receipt.sourceSha256.toLowerCase() !== parent.contentHash.toLowerCase() ||
      receipt.modelId !== "drumsep-cpu-v1" ||
      receipt.parentRole !== "drums" ||
      receipt.restorationCertified !== false || receipt.needsListeningReview !== true ||
      receipt.stems.length !== ROLES.length ||
      !Number.isFinite(receipt.qc?.residualRmsRatio) || receipt.qc.residualRmsRatio < 0) {
    throw new Error("Deep drum receipt invalid, incomplete or not bound to parent.");
  }
  const receivedRoles = new Set<DrumSubStemRole>();
  for (const stem of receipt.stems) {
    if (!ROLES.includes(stem.role) || receivedRoles.has(stem.role) ||
        stem.parentArtifactId !== parent.id ||
        stem.modelId !== receipt.modelId ||
        stem.confidenceStatus !== "unmeasured" ||
        !/^[0-9a-f]{64}$/i.test(stem.sha256) ||
        !stem.runtimeReceiptId || !stem.artifactId ||
        stem.sampleRate !== parent.sampleRate || stem.channels !== parent.channels ||
        !Number.isInteger(stem.sampleCount) ||
        Math.abs(stem.sampleCount - parent.sampleCount) > 512 ||
        !stem.resultUri.startsWith("/v1/jobs/")) {
      throw new Error("Deep drum stem shape, evidence or timebase invalid.");
    }
    receivedRoles.add(stem.role);
    if (await input.store.get(input.ownerUserId, stem.artifactId)) {
      throw new Error("Deep drum artifact ID already exists.");
    }
  }
  if (receivedRoles.size !== ROLES.length) throw new Error("Missing deep drum roles.");

  const rootId = parent.parentArtifactId;
  const now = input.now ?? new Date().toISOString();
  const artifacts: StoredRestorationArtifact[] = [];
  const nodes: DeepStemNode[] = [
    {
      id: rootId, sourceArtifactId: rootId, kind: "mix", label: "original source identity",
      region: { startSample: 0, endSample: parent.sampleCount },
      sampleRate: parent.sampleRate, modelId: "canonical-source",
      modelVersion: "1", sourceKind: "source-mix", confidence: 0,
      evidenceIds: [], provenanceIds: [], canonicalSource: false,
    },
    {
      id: parent.id, sourceArtifactId: rootId, parentId: rootId, kind: "stem", label: "drums",
      region: { startSample: 0, endSample: parent.sampleCount },
      sampleRate: parent.sampleRate, modelId: "parent-separation",
      modelVersion: "unknown", sourceKind: "separated-stem", confidence: 0,
      evidenceIds: parent.runtimeReceiptId ? [parent.runtimeReceiptId] : [],
      provenanceIds: ["sha256:" + parent.contentHash], canonicalSource: false,
    },
  ];
  for (const stem of receipt.stems) {
    const bytes = await input.runtime.downloadArtifact(stem.resultUri);
    if (!bytes.byteLength || bytes.byteLength > MAX_STEM_BYTES ||
        (await sha256Hex(bytes)).toLowerCase() !== stem.sha256.toLowerCase()) {
      throw new Error("Deep drum downloaded bytes missing, oversized or SHA-256 mismatched.");
    }
    const stored = await input.store.putDerived({
      ownerUserId: input.ownerUserId, caseId: input.caseId,
      artifactId: stem.artifactId, parentArtifactId: parent.id,
      fileName: stem.role + ".wav", mimeType: "audio/wav",
      sha256: stem.sha256.toLowerCase(), bytes, role: "drums." + stem.role,
    });
    const artifact: StoredRestorationArtifact = {
      id: stem.artifactId, kind: "derived", contentHash: stem.sha256.toLowerCase(),
      parentArtifactId: parent.id, ownerUserId: input.ownerUserId,
      caseId: input.caseId, role: "drums." + stem.role,
      sampleRate: stem.sampleRate, channels: stem.channels,
      sampleCount: stem.sampleCount, mimeType: "audio/wav", sizeBytes: bytes.byteLength,
      storageUri: stored.storageUri, createdAt: now, runtimeReceiptId: stem.runtimeReceiptId,
    };
    await input.store.register(artifact);
    artifacts.push(artifact);
    nodes.push({
      id: artifact.id, sourceArtifactId: rootId, parentId: parent.id, kind: "sub-stem",
      label: stem.role, region: { startSample: 0, endSample: stem.sampleCount },
      sampleRate: stem.sampleRate, modelId: stem.modelId, modelVersion: stem.modelVersion,
      sourceKind: "recursive-separation", confidence: 0,
      residualEnergy: stem.role === "residual"
        ? Math.min(1, receipt.qc.residualEnergyRatio)
        : undefined,
      evidenceIds: [stem.runtimeReceiptId],
      provenanceIds: [receipt.runtimeReceiptId, "sha256:" + stem.sha256],
      canonicalSource: false,
    });
  }
  const decomposition = buildDeepStemDecomposition({
    id: "deep-drums:" + receipt.runtimeReceiptId,
    sourceArtifactId: rootId, rootId, nodes,
  });
  if (decomposition.abstained) throw new Error("Deep drum lineage graph invalid.");
  return { jobId: receipt.jobId, parentArtifactId: parent.id,
           artifacts, decomposition, receipt };
}

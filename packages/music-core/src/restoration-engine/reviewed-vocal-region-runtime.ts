import { sha256Hex, type RestorationArtifactStore, type StoredRestorationArtifact } from "./ingest-runtime.js";
import type { RestorationRuntimeClient, ReviewedVocalRegion, ReviewedVocalRegionsReceipt } from "./runtime-contract.js";

const MAX_BYTES = 250 * 1024 * 1024;

/** Actual reviewed regions become DAW tracks; neither timeline labels nor
 * spectral masks are proof of automatic speaker-source isolation. */
export async function renderAndPersistReviewedVocalRegions(input: {
  ownerUserId: string;
  caseId: string;
  parent: StoredRestorationArtifact;
  regions: ReviewedVocalRegion[];
  runtime: RestorationRuntimeClient;
  store: RestorationArtifactStore;
  jobId: string;
  now?: string;
}): Promise<{ artifacts: StoredRestorationArtifact[]; receipt: ReviewedVocalRegionsReceipt }> {
  const { parent } = input;
  if (parent.ownerUserId !== input.ownerUserId || parent.caseId !== input.caseId ||
      parent.kind !== "derived" || parent.role !== "vocals" || !parent.parentArtifactId) {
    throw new Error("MUSIC_VOCAL_REGIONS_OWNED_PARENT_REQUIRED");
  }
  if (!input.runtime.renderReviewedVocalRegions) throw new Error("MUSIC_VOCAL_REGIONS_RUNTIME_NOT_COMMISSIONED");
  const receipt = await input.runtime.renderReviewedVocalRegions({
    jobId: input.jobId,
    source: {
      artifactId: parent.id,
      uri: await input.store.resolveRuntimeUri(input.ownerUserId, parent.id),
      sha256: parent.contentHash, mimeType: parent.mimeType,
    },
    parentRole: "vocals", regions: input.regions,
  });
  if (receipt.jobId !== input.jobId || receipt.sourceArtifactId !== parent.id ||
      receipt.sourceSha256.toLowerCase() !== parent.contentHash.toLowerCase() ||
      receipt.outputClass !== "human-reviewed-time-region-masks" ||
      receipt.automatedSpeakerSeparationPerformed !== false ||
      receipt.restorationCertified !== false ||
      receipt.qc.recombinedRenderMeasured !== true ||
      receipt.qc.isolationCertified !== false ||
      receipt.qc.recombinationErrorRatio > 2e-6) {
    throw new Error("MUSIC_VOCAL_REGIONS_SOURCE_RECEIPT_INVALID");
  }
  const expected = new Set<ReviewedVocalRegionRole | "residual">(input.regions.map(r => r.role));
  expected.add("residual");
  if (expected.size !== receipt.stems.length) throw new Error("MUSIC_VOCAL_REGIONS_MISSING_LAYERS");
  const staged: Array<{ stem: ReviewedVocalRegionsReceipt["stems"][number]; bytes: Uint8Array }> = [];
  for (const stem of receipt.stems) {
    if (!expected.delete(stem.role) || stem.parentArtifactId !== parent.id ||
        stem.modelId !== "reviewed-vocal-mask-v1" ||
        stem.confidenceStatus !== "human-annotation-not-isolation" ||
        !/^[a-f0-9]{64}$/i.test(stem.sha256) ||
        !/^\/v1\/jobs\/[a-f0-9]{24}\/artifact\/[-a-z]+\.wav$/.test(stem.resultUri) ||
        stem.sampleRate !== parent.sampleRate || stem.channels !== parent.channels ||
        Math.abs(stem.sampleCount - parent.sampleCount) > 512 ||
        await input.store.get(input.ownerUserId,stem.artifactId)) {
      throw new Error("MUSIC_VOCAL_REGIONS_STEM_INTEGRITY_INVALID");
    }
    const evidence = input.regions.filter(r => r.role === stem.role).map(r=>r.reviewEvidenceId);
    if (evidence.length !== stem.reviewEvidenceIds.length ||
        evidence.some(id=>!stem.reviewEvidenceIds.includes(id))) {
      throw new Error("MUSIC_VOCAL_REGIONS_REVIEW_EVIDENCE_INVALID");
    }
    const bytes = await input.runtime.downloadArtifact(stem.resultUri);
    if (bytes.byteLength < 48 || bytes.byteLength > MAX_BYTES ||
        (await sha256Hex(bytes)).toLowerCase() !== stem.sha256.toLowerCase()) {
      throw new Error("MUSIC_VOCAL_REGIONS_BYTES_HASH_INVALID");
    }
    staged.push({ stem, bytes });
  }
  if (expected.size) throw new Error("MUSIC_VOCAL_REGIONS_MISSING_LAYERS");
  const artifacts: StoredRestorationArtifact[] = [];
  for (const { stem, bytes } of staged) {
    const stored = await input.store.putDerived({
      ownerUserId: input.ownerUserId, caseId: input.caseId,
      artifactId: stem.artifactId, parentArtifactId: parent.id,
      fileName: stem.role + ".wav", mimeType: "audio/wav",
      sha256: stem.sha256.toLowerCase(), bytes, role: "vocal-reviewed." + stem.role,
    });
    const artifact: StoredRestorationArtifact = {
      id: stem.artifactId, ownerUserId: input.ownerUserId, caseId: input.caseId,
      parentArtifactId: parent.id, kind: "derived", role: "vocal-reviewed." + stem.role,
      contentHash: stem.sha256.toLowerCase(), sampleRate: stem.sampleRate,
      channels: stem.channels, sampleCount: stem.sampleCount,
      mimeType: "audio/wav", sizeBytes: bytes.length,
      storageUri: stored.storageUri, createdAt: input.now ?? new Date().toISOString(),
      runtimeReceiptId: stem.runtimeReceiptId,
    };
    await input.store.register(artifact);
    artifacts.push(artifact);
  }
  return { artifacts, receipt };
}

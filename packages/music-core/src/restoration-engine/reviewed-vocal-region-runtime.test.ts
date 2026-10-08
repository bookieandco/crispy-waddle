import { describe, expect, it } from "vitest";
import { sha256Hex, type StoredRestorationArtifact, type RestorationArtifactStore } from "./ingest-runtime.js";
import { renderAndPersistReviewedVocalRegions } from "./reviewed-vocal-region-runtime.js";
import type {
  RestorationRuntimeClient,
  ReviewedVocalRegion,
  ReviewedVocalRegionsReceipt,
} from "./runtime-contract.js";

const parent: StoredRestorationArtifact = {
  id: "vocals-parent", kind: "derived", parentArtifactId: "original-master",
  ownerUserId: "owner", caseId: "case", role: "vocals",
  sampleRate: 16000, channels: 1, sampleCount: 16000,
  contentHash: "a".repeat(64), storageUri: "private://vocals.wav",
  sizeBytes: 64044, mimeType: "audio/wav", createdAt: "2026-10-07T00:00:00Z",
};
const regions: ReviewedVocalRegion[] = [{
  role: "ad-lib", startMs: 100, endMs: 700,
  ownerReviewed: true, reviewEvidenceId: "owner-reviewed-region",
}];
const audio = new Uint8Array([82,73,70,70,...Array(50).fill(0)]);

async function setup() {
  const hash = await sha256Hex(audio);
  const base = {
    parentArtifactId: parent.id,
    sampleRate: 16000, channels: 1, sampleCount: 16000,
    sourceKind: "reviewed-region-mask" as const,
    modelId: "reviewed-vocal-mask-v1" as const,
    confidenceStatus: "human-annotation-not-isolation" as const,
  };
  const receipt: ReviewedVocalRegionsReceipt = {
    jobId: "job", sourceArtifactId: parent.id, sourceSha256: parent.contentHash,
    parentRole: "vocals", stems: [
      {...base, artifactId:"ad-lib",role:"ad-lib",sha256:hash,
        resultUri:"/v1/jobs/"+"a".repeat(24)+"/artifact/ad-lib.wav",
        reviewEvidenceIds:["owner-reviewed-region"],runtimeReceiptId:"review-ad-lib"},
      {...base,artifactId:"residual",role:"residual",sha256:hash,
        resultUri:"/v1/jobs/"+"a".repeat(24)+"/artifact/residual.wav",
        reviewEvidenceIds:[],runtimeReceiptId:"review-residual"},
    ],
    qc:{recombinationErrorRatio:0.00000003,maxAbsoluteRecombinationError:0.0000001,
      recombinedRenderMeasured:true,isolationCertified:false},
    outputClass:"human-reviewed-time-region-masks",
    automatedSpeakerSeparationPerformed:false,
    needsListeningReview:true,restorationCertified:false,
    runtimeReceiptId:"job-receipt",
  };
  const saved: StoredRestorationArtifact[] = [];
  const store = {
    resolveRuntimeUri: async()=>"https://owner-assets.example/vocals.wav",
    get:async()=>undefined,
    putDerived:async()=>({storageUri:"private://derived",runtimeUri:"https://owner-assets.example/derived"}),
    register:async(a:StoredRestorationArtifact)=>{saved.push(a)},
  } as unknown as RestorationArtifactStore;
  const runtime = {
    renderReviewedVocalRegions:async()=>receipt,
    downloadArtifact:async()=>audio,
  } as unknown as RestorationRuntimeClient;
  const input = {ownerUserId:"owner",caseId:"case",parent,regions,runtime,store,jobId:"job"};
  return {input,receipt,store,runtime,saved};
}

describe("actual vocal time mask case persistence is NOT singer isolation",()=>{
  it("persists hash-bound reviewed ad-lib audio + residual, preserving the parent",async()=>{
    const f=await setup();
    const result=await renderAndPersistReviewedVocalRegions(f.input);
    expect(result.artifacts.map(a=>a.role)).toEqual(["vocal-reviewed.ad-lib","vocal-reviewed.residual"]);
    expect(result.artifacts.every(a=>a.parentArtifactId==="vocals-parent")).toBe(true);
    expect(result.receipt.automatedSpeakerSeparationPerformed).toBe(false);
    expect(result.receipt.qc.isolationCertified).toBe(false);
    expect(f.saved).toHaveLength(2);
  });
  it("rejects unowned/wrong source, tampered audio and unjustified speaker-isolation claims",async()=>{
    const f=await setup();
    await expect(renderAndPersistReviewedVocalRegions({
      ...f.input,ownerUserId:"intruder",
    })).rejects.toThrow("OWNED_PARENT");
    const falseSeparation = {
      ...f.receipt,automatedSpeakerSeparationPerformed:true,
    } as ReviewedVocalRegionsReceipt;
    await expect(renderAndPersistReviewedVocalRegions({
      ...f.input,runtime:{...f.runtime,renderReviewedVocalRegions:async()=>falseSeparation} as RestorationRuntimeClient,
    })).rejects.toThrow("SOURCE_RECEIPT");
    await expect(renderAndPersistReviewedVocalRegions({
      ...f.input,runtime:{...f.runtime,downloadArtifact:async()=>new Uint8Array(50).fill(1)} as RestorationRuntimeClient,
    })).rejects.toThrow("BYTES_HASH");
    expect(f.saved).toHaveLength(0);
  });
  it("rejects receipt that suppresses residual or mismatches owner evidence",async()=>{
    const f=await setup();
    const missing = {...f.receipt,stems:[f.receipt.stems[0]!]};
    await expect(renderAndPersistReviewedVocalRegions({
      ...f.input,runtime:{...f.runtime,renderReviewedVocalRegions:async()=>missing} as RestorationRuntimeClient,
    })).rejects.toThrow("MISSING_LAYERS");
    const dishonest = {...f.receipt,
      stems:f.receipt.stems.map(a=>a.role==="ad-lib"?{...a,reviewEvidenceIds:["other"]}:a)};
    await expect(renderAndPersistReviewedVocalRegions({
      ...f.input,runtime:{...f.runtime,renderReviewedVocalRegions:async()=>dishonest} as RestorationRuntimeClient,
    })).rejects.toThrow("REVIEW_EVIDENCE");
  });
});

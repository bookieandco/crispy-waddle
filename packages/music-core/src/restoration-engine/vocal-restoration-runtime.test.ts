import { describe, expect, it } from "vitest";
import type { RestorationCase } from "../restoration.js";
import type { VocalRestorationRequest } from "../vocal-restoration.js";
import {
  sha256Hex,
  type RestorationArtifactStore,
  type StoredRestorationArtifact,
} from "./ingest-runtime.js";
import { restoreVocalArtifact } from "./vocal-restoration-runtime.js";
import type {
  RestorationPerceptionReceipt,
  RestorationProbeReceipt,
  RestorationReconstructionReceipt,
  RestorationRepairReceipt,
  RestorationRuntimeClient,
  RestorationRuntimeSource,
  RestorationSeparationReceipt,
  RestorationVocalRepairReceipt,
} from "./runtime-contract.js";

class MemoryStore implements RestorationArtifactStore {
  readonly artifacts=new Map<string,StoredRestorationArtifact>();
  readonly cases=new Map<string,RestorationCase>();
  async putImmutableSource(input:{ownerUserId:string;caseId:string;artifactId:string;fileName:string;mimeType:string;sha256:string;bytes:Uint8Array}){
    return {storageUri:`memory://${input.artifactId}`,runtimeUri:`https://runtime.test/${input.artifactId}`};
  }
  async putDerived(input:{ownerUserId:string;caseId:string;artifactId:string;parentArtifactId:string;fileName:string;mimeType:string;sha256:string;bytes:Uint8Array;role?:string}){
    return {storageUri:`memory://${input.artifactId}`,runtimeUri:`https://runtime.test/${input.artifactId}`};
  }
  async resolveRuntimeUri(_ownerUserId:string,artifactId:string){ return `https://runtime.test/${artifactId}`; }
  async registerCase(value:RestorationCase){ this.cases.set(value.id,value); }
  async register(value:StoredRestorationArtifact){ this.artifacts.set(value.id,value); }
  async get(_ownerUserId:string,artifactId:string){ return this.artifacts.get(artifactId); }
}

function runtime(overrides:Partial<RestorationRuntimeClient>={}):RestorationRuntimeClient{
  return {
    async probe(_source:RestorationRuntimeSource):Promise<RestorationProbeReceipt>{ throw new Error("not configured"); },
    async separate():Promise<RestorationSeparationReceipt>{ throw new Error("not configured"); },
    async perceive():Promise<RestorationPerceptionReceipt>{ throw new Error("not configured"); },
    async execute():Promise<RestorationRepairReceipt>{ throw new Error("not configured"); },
    async reconstruct():Promise<RestorationReconstructionReceipt>{ throw new Error("not configured"); },
    async downloadArtifact(){ throw new Error("not configured"); },
    ...overrides,
  };
}

function vocalArtifact(role="vocals"):StoredRestorationArtifact{
  return {
    id:"stem-vocals",
    kind:"derived",
    contentHash:"a".repeat(64),
    sampleRate:48000,
    channels:2,
    sampleCount:240000,
    parentArtifactId:"source-1",
    createdAt:"2026-09-30T08:00:00.000Z",
    ownerUserId:"user-1",
    caseId:"case-1",
    storageUri:"memory://stem-vocals",
    mimeType:"audio/wav",
    sizeBytes:1000,
    role,
  };
}

function request():VocalRestorationRequest{
  return {
    requestId:"vocal-request-1",
    sourceArtifactId:"stem-vocals",
    profile:{declick:true,declip:false,denoiseNoiseFloorDb:-55,highPassHz:65},
    evidenceIds:["damage:vocal:1"],
    approval:{
      approvedByUserId:"user-1",
      approvedAt:"2026-09-30T08:01:00.000Z",
      evidenceId:"approval:vocal:1",
    },
  };
}

function receipt(hash:string,identityPreserved=true):RestorationVocalRepairReceipt{
  return {
    jobId:"vocal-job-1",
    requestId:"vocal-request-1",
    sourceArtifactId:"stem-vocals",
    outputArtifactId:"vocal-restored-1",
    resultUri:"/output.wav",
    outputSha256:hash,
    sampleRate:48000,
    channels:2,
    sampleCount:240000,
    durationSeconds:5,
    before:{
      voicedFraction:0.72,medianF0Hz:220,f0DeviationCents:65,
      spectralCentroidHz:2100,rmsDb:-18,dynamicRangeDb:13,mfccMean:[1,2,3],
    },
    after:{
      voicedFraction:0.70,medianF0Hz:220.5,f0DeviationCents:66,
      spectralCentroidHz:2080,rmsDb:-17.7,dynamicRangeDb:13.2,mfccMean:[1.01,2.01,2.99],
    },
    comparison:{
      medianF0DriftCents:3.93,
      f0DeviationDeltaCents:1,
      voicedFractionDelta:0.02,
      timbreCosine:0.999,
      rmsDeltaDb:0.3,
      identityPreserved,
      reasons:identityPreserved?[]:["MFCC timbre similarity fell below 0.90"],
    },
    runtimeReceiptId:"music-vocal-restoration:receipt-1",
  };
}

describe("vocal restoration runtime",()=>{
  it("persists an identity-preserving vocal result and keeps it Director-ready",async()=>{
    const store=new MemoryStore();
    const source=vocalArtifact();
    store.artifacts.set(source.id,source);
    const bytes=new TextEncoder().encode("identity-preserved-vocal");
    const hash=await sha256Hex(bytes);

    const result=await restoreVocalArtifact({
      ownerUserId:"user-1",caseId:"case-1",request:request(),source,store,
      runtime:runtime({
        async restoreVocal(){ return receipt(hash,true); },
        async downloadArtifact(){ return bytes; },
      }),
      jobId:"vocal-job-1",
      now:"2026-09-30T08:02:00.000Z",
    });

    expect(result.status).toBe("rendered");
    expect(result.qc.identityPreserved).toBe(true);
    expect(result.qc.requiresAudition).toBe(true);
    expect(result.storedArtifact.role).toBe("vocals");
    expect(result.storedArtifact.parentArtifactId).toBe(source.id);
    expect(store.artifacts.get("vocal-restored-1")?.contentHash).toBe(hash);
  });

  it("rejects a non-vocal artifact before runtime execution",async()=>{
    const store=new MemoryStore();
    const source=vocalArtifact("drums");
    store.artifacts.set(source.id,source);
    let called=false;
    await expect(restoreVocalArtifact({
      ownerUserId:"user-1",caseId:"case-1",request:request(),source,store,
      runtime:runtime({
        async restoreVocal(){ called=true; return receipt("b".repeat(64),true); },
      }),
      jobId:"vocal-job-1",
    })).rejects.toThrow("MUSIC_VOCAL_RESTORATION_VOCAL_STEM_REQUIRED");
    expect(called).toBe(false);
  });

  it("rejects identity drift before durable artifact registration",async()=>{
    const store=new MemoryStore();
    const source=vocalArtifact();
    store.artifacts.set(source.id,source);
    await expect(restoreVocalArtifact({
      ownerUserId:"user-1",caseId:"case-1",request:request(),source,store,
      runtime:runtime({
        async restoreVocal(){ return receipt("c".repeat(64),false); },
      }),
      jobId:"vocal-job-1",
    })).rejects.toThrow("MUSIC_VOCAL_RESTORATION_IDENTITY_QC_FAILED");
    expect(store.artifacts.has("vocal-restored-1")).toBe(false);
  });

  it("rejects a receipt hash that does not match downloaded vocal bytes",async()=>{
    const store=new MemoryStore();
    const source=vocalArtifact();
    store.artifacts.set(source.id,source);
    await expect(restoreVocalArtifact({
      ownerUserId:"user-1",caseId:"case-1",request:request(),source,store,
      runtime:runtime({
        async restoreVocal(){ return receipt("d".repeat(64),true); },
        async downloadArtifact(){ return new TextEncoder().encode("different-vocal-bytes"); },
      }),
      jobId:"vocal-job-1",
    })).rejects.toThrow("MUSIC_VOCAL_RESTORATION_OUTPUT_HASH_MISMATCH");
    expect(store.artifacts.has("vocal-restored-1")).toBe(false);
  });
});

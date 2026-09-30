import { describe, expect, it } from "vitest";
import type { RestorationCase } from "../restoration.js";
import type { VocalRestorationRequest } from "../vocal-restoration.js";
import { sha256Hex, type RestorationArtifactStore, type StoredRestorationArtifact } from "./ingest-runtime.js";
import { restoreVocalRegions } from "./vocal-restoration-runtime.js";
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

function runtime(overrides:Partial<RestorationRuntimeClient>={}):RestorationRuntimeClient {
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

function source(role="vocals"):StoredRestorationArtifact {
  return {
    id:"vocals-1",
    kind:"derived",
    contentHash:"a".repeat(64),
    sampleRate:48000,
    channels:2,
    sampleCount:240000,
    parentArtifactId:"source-1",
    createdAt:"2026-09-30T00:00:00.000Z",
    ownerUserId:"user-1",
    caseId:"case-1",
    storageUri:"memory://vocals-1",
    mimeType:"audio/wav",
    sizeBytes:1000,
    role,
  };
}

function request():VocalRestorationRequest {
  return {
    requestId:"vocal-request-1",
    sourceArtifactId:"vocals-1",
    segments:[{
      startMs:1000,
      endMs:1400,
      operation:"denoise",
      parameters:{noiseFloorDb:-55},
      sourceResidualMix:0.08,
      fadeMs:20,
      evidenceIds:["damage:vocal:1"],
      hierarchy:{
        phraseId:"phrase-1",
        word:"hello",
        syllable:"hel",
        phoneme:"HH",
        nextPhoneme:"EH",
      },
    }],
    evidenceIds:["damage:vocal:1"],
    approval:{
      approvedByUserId:"user-1",
      approvedAt:"2026-09-30T00:01:00.000Z",
      evidenceId:"approval:vocal-1",
    },
  };
}

const preservation = {
  passed:true,
  sourceVoicedFraction:0.72,
  outputVoicedFraction:0.70,
  voicedFractionDelta:0.02,
  sourceMedianF0Hz:220,
  outputMedianF0Hz:221,
  medianF0CentsDelta:7.85,
  sourceF0SpreadCents:115,
  outputF0SpreadCents:120,
  f0SpreadCentsDelta:5,
  sourceSpectralCentroidHz:2400,
  outputSpectralCentroidHz:2450,
  spectralCentroidRelativeDelta:0.021,
  sourceRmsDb:-18,
  outputRmsDb:-18.5,
  rmsDbDelta:0.5,
  sourceHarmonicity:0.68,
  outputHarmonicity:0.66,
  harmonicityDelta:0.02,
  reasons:[],
};

describe("vocal restoration runtime",()=>{
  it("requires a persisted vocal artifact",async()=>{
    const store=new MemoryStore();
    const nonVocal=source("drums");
    store.artifacts.set(nonVocal.id,nonVocal);

    await expect(restoreVocalRegions({
      ownerUserId:"user-1",
      caseId:"case-1",
      request:request(),
      source:nonVocal,
      runtime:runtime(),
      store,
    })).rejects.toThrow("MUSIC_VOCAL_RESTORATION_VOCAL_STEM_REQUIRED");
  });

  it("rejects worker output when vocal identity preservation fails",async()=>{
    const store=new MemoryStore();
    const vocal=source();
    store.artifacts.set(vocal.id,vocal);

    await expect(restoreVocalRegions({
      ownerUserId:"user-1",
      caseId:"case-1",
      request:request(),
      source:vocal,
      store,
      runtime:runtime({
        async restoreVocal(input):Promise<RestorationVocalRepairReceipt>{
          return {
            jobId:input.jobId,
            requestId:input.requestId,
            sourceArtifactId:input.source.artifactId,
            sourceSha256:input.source.sha256,
            outputArtifactId:"vocal-output-1",
            resultUri:"/output.wav",
            outputSha256:"b".repeat(64),
            sampleRate:48000,
            channels:2,
            sampleCount:240000,
            durationSeconds:5,
            segmentCount:1,
            preservation:{...preservation,passed:false,reasons:["median F0 drift exceeds 50 cents"]},
            runtimeReceiptId:"music-vocal-restoration:failed",
          };
        },
      }),
    })).rejects.toThrow("MUSIC_VOCAL_RESTORATION_IDENTITY_DRIFT");
    expect(store.artifacts.has("vocal-output-1")).toBe(false);
  });

  it("re-hashes and durably admits preservation-passing vocal output",async()=>{
    const store=new MemoryStore();
    const vocal=source();
    store.artifacts.set(vocal.id,vocal);
    const bytes=new TextEncoder().encode("restored-vocal");
    const digest=await sha256Hex(bytes);

    const result=await restoreVocalRegions({
      ownerUserId:"user-1",
      caseId:"case-1",
      request:request(),
      source:vocal,
      store,
      now:"2026-09-30T00:02:00.000Z",
      runtime:runtime({
        async restoreVocal(input):Promise<RestorationVocalRepairReceipt>{
          expect(input.source.artifactId).toBe("vocals-1");
          expect(input.segments[0]).toMatchObject({
            startMs:1000,
            endMs:1400,
            operation:"denoise",
            sourceResidualMix:0.08,
            fadeMs:20,
          });
          return {
            jobId:input.jobId,
            requestId:input.requestId,
            sourceArtifactId:input.source.artifactId,
            sourceSha256:input.source.sha256,
            outputArtifactId:"vocal-output-1",
            resultUri:"/output.wav",
            outputSha256:digest,
            sampleRate:48000,
            channels:2,
            sampleCount:240000,
            durationSeconds:5,
            segmentCount:1,
            preservation,
            runtimeReceiptId:"music-vocal-restoration:ok",
          };
        },
        async downloadArtifact(){ return bytes; },
      }),
    });

    expect(result.storedArtifact.id).toBe("vocal-output-1");
    expect(result.storedArtifact.role).toBe("vocal-restoration");
    expect(result.storedArtifact.contentHash).toBe(digest);
    expect(result.qc.passed).toBe(true);
    expect(result.qc.requiresAudition).toBe(true);
    expect(store.artifacts.get("vocal-output-1")?.parentArtifactId).toBe("vocals-1");
  });
});

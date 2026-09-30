import { describe, expect, it } from "vitest";
import {
  decideInstrumentReplacement,
  type InstrumentFingerprint,
} from "../instrument-replacement.js";
import type { InstrumentReconstructionRequest } from "../instrument-reconstruction.js";
import { sha256Hex, type RestorationArtifactStore, type StoredRestorationArtifact } from "./ingest-runtime.js";
import {
  assessInstrumentReplacementArtifacts,
  reconstructInstrumentRegions,
} from "./instrument-reconstruction-runtime.js";
import type {
  RestorationPerceptionReceipt,
  RestorationProbeReceipt,
  RestorationReconstructionReceipt,
  RestorationRepairReceipt,
  RestorationRuntimeClient,
  RestorationRuntimeSource,
  RestorationSeparationReceipt,
} from "./runtime-contract.js";
import type { RestorationCase } from "../restoration.js";

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

const fingerprint:InstrumentFingerprint={
  family:"drums",
  spectralCentroidHz:2600,
  spectralSpreadHz:3100,
  lowEnergyRatio:0.35,
  midEnergyRatio:0.45,
  highEnergyRatio:0.20,
  transientStrength:0.90,
  harmonicity:0.12,
  stereoWidth:0.65,
  dynamicRangeDb:14,
};

function artifacts(){
  const source:StoredRestorationArtifact={
    id:"drums-damaged",kind:"derived",contentHash:"a".repeat(64),sampleRate:48000,channels:2,sampleCount:240000,
    parentArtifactId:"source-1",createdAt:"2026-09-30T00:00:00.000Z",ownerUserId:"user-1",caseId:"case-1",
    storageUri:"memory://drums-damaged",mimeType:"audio/wav",sizeBytes:1000,role:"drums",
  };
  const replacement:StoredRestorationArtifact={
    id:"drums-donor",kind:"derived",contentHash:"b".repeat(64),sampleRate:48000,channels:2,sampleCount:240000,
    parentArtifactId:"source-1",createdAt:"2026-09-30T00:00:00.000Z",ownerUserId:"user-1",caseId:"case-1",
    storageUri:"memory://drums-donor",mimeType:"audio/wav",sizeBytes:900,role:"drums",
  };
  return {source,replacement};
}

function request():InstrumentReconstructionRequest{
  return {
    requestId:"reconstruct-1",
    sourceArtifactId:"drums-damaged",
    replacementArtifactId:"drums-donor",
    instrumentFamily:"drums",
    scope:"segments",
    segments:[{
      targetStartMs:1000,targetEndMs:1500,
      replacementStartMs:2000,replacementEndMs:2600,
      gainDb:-1.5,sourceResidualMix:0.08,fadeMs:20,phaseInvert:false,
    }],
    fingerprintSimilarity:0.94,
    expectedGain:0.55,
    gainConfidence:0.91,
    gainEvidenceMethod:"same-session-a-b-v1",
    evidenceIds:["fingerprint:e1","damage:e2"],
    approval:{
      approvedByUserId:"user-1",
      approvedAt:"2026-09-30T00:01:00.000Z",
      evidenceId:"approval:user-1:reconstruct-1",
    },
  };
}

describe("instrument reconstruction",()=>{
  it("rejects replacement decisions without sufficiently confident gain evidence",()=>{
    const decision=decideInstrumentReplacement({
      observed:fingerprint,
      candidate:{
        id:"candidate-1",label:"same-session snare",fingerprint,
        sourceArtifactId:"drums-damaged",replacementArtifactId:"drums-donor",
      },
      gainEvidence:{method:"a-b-model-v1",expectedGain:0.7,confidence:0.2},
    });
    expect(decision.replace).toBe(false);
    expect(decision.reason).toContain("gain evidence confidence");
  });

  it("derives donor admission from real artifact regions through the runtime",async()=>{
    const store=new MemoryStore();
    const {source,replacement}=artifacts();
    store.artifacts.set(source.id,source);
    store.artifacts.set(replacement.id,replacement);
    let assessmentRequest:unknown;

    const receipt=await assessInstrumentReplacementArtifacts({
      ownerUserId:"user-1",
      instrumentFamily:"drums",
      segments:request().segments,
      source,
      replacement,
      store,
      runtime:runtime({
        async assessInstrumentReplacement(input){
          assessmentRequest=input;
          return {
            assessmentId:input.assessmentId,
            sourceArtifactId:input.source.artifactId,
            replacementArtifactId:input.replacement.artifactId,
            sourceSha256:input.source.sha256,
            replacementSha256:input.replacement.sha256,
            instrumentFamily:"drums",
            observedFingerprint:fingerprint,
            replacementFingerprint:{...fingerprint,spectralCentroidHz:2650},
            gainEvidence:{
              method:"runtime-region-integrity-delta-v1",
              expectedGain:0.55,
              confidence:0.91,
            },
            diagnostics:{
              sourceDamageScore:0.7,
              replacementDamageScore:0.15,
              sourceClippingRatio:0.003,
              replacementClippingRatio:0,
              sourceDropoutRatio:0.1,
              replacementDropoutRatio:0.01,
              sourceDurationMs:500,
              replacementDurationMs:600,
            },
            runtimeReceiptId:"music-instrument-assessment:receipt-1",
          };
        },
      }),
      assessmentId:"assessment-1",
    });

    expect(assessmentRequest).toMatchObject({
      assessmentId:"assessment-1",
      source:{artifactId:"drums-damaged"},
      replacement:{artifactId:"drums-donor"},
      instrumentFamily:"drums",
      segments:[{
        sourceStartMs:1000,
        sourceEndMs:1500,
        replacementStartMs:2000,
        replacementEndMs:2600,
      }],
    });
    expect(receipt.gainEvidence.method).toBe("runtime-region-integrity-delta-v1");
    expect(receipt.runtimeReceiptId).toBe("music-instrument-assessment:receipt-1");
  });

  it("renders, independently re-hashes and registers a reconstructed artifact",async()=>{
    const store=new MemoryStore();
    const {source,replacement}=artifacts();
    store.artifacts.set(source.id,source);
    store.artifacts.set(replacement.id,replacement);
    const bytes=new TextEncoder().encode("localized-reconstruction");
    const hash=await sha256Hex(bytes);
    let runtimeRequest:unknown;

    const result=await reconstructInstrumentRegions({
      ownerUserId:"user-1",caseId:"case-1",request:request(),source,replacement,store,
      runtime:runtime({
        async reconstruct(input){
          runtimeRequest=input;
          return {
            jobId:input.jobId,requestId:input.requestId,
            sourceArtifactId:input.source.artifactId,replacementArtifactId:input.replacement.artifactId,
            outputArtifactId:"reconstruction-output",resultUri:"/output.wav",outputSha256:hash,
            sampleRate:48000,channels:2,sampleCount:240000,durationSeconds:5,segmentCount:1,
            runtimeReceiptId:"music-reconstruction:receipt-1",
          };
        },
        async downloadArtifact(){ return bytes; },
      }),
      now:"2026-09-30T00:02:00.000Z",
    });

    expect(runtimeRequest).toMatchObject({
      source:{artifactId:"drums-damaged"},
      replacement:{artifactId:"drums-donor"},
      segments:[{gainDb:-1.5,sourceResidualMix:0.08,fadeMs:20,phaseInvert:false}],
    });
    expect(result.storedArtifact.kind).toBe("reconstructed");
    expect(result.storedArtifact.parentArtifactId).toBe("drums-damaged");
    expect(result.provenance.replacementArtifactId).toBe("drums-donor");
    expect(result.qc.requiresAudition).toBe(true);
    expect(store.artifacts.get("reconstruction-output")?.contentHash).toBe(hash);
  });

  it("rejects worker output when downloaded bytes do not match the receipt hash",async()=>{
    const store=new MemoryStore();
    const {source,replacement}=artifacts();
    store.artifacts.set(source.id,source);
    store.artifacts.set(replacement.id,replacement);

    await expect(reconstructInstrumentRegions({
      ownerUserId:"user-1",caseId:"case-1",request:request(),source,replacement,store,
      runtime:runtime({
        async reconstruct(input){
          return {
            jobId:input.jobId,requestId:input.requestId,
            sourceArtifactId:input.source.artifactId,replacementArtifactId:input.replacement.artifactId,
            outputArtifactId:"bad-output",resultUri:"/output.wav",outputSha256:"c".repeat(64),
            sampleRate:48000,channels:2,sampleCount:240000,durationSeconds:5,segmentCount:1,
            runtimeReceiptId:"music-reconstruction:bad",
          };
        },
        async downloadArtifact(){ return new TextEncoder().encode("different-bytes"); },
      }),
    })).rejects.toThrow("MUSIC_RECONSTRUCTION_OUTPUT_HASH_MISMATCH");
    expect(store.artifacts.has("bad-output")).toBe(false);
  });
});

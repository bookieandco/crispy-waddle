import { describe, expect, it } from "vitest";
import { ingestRestorationSource, sha256Hex, type RestorationArtifactStore, type StoredRestorationArtifact } from "./ingest-runtime.js";
import { separateRestorationSource } from "./separation-runtime.js";
import { perceiveRestorationArtifact } from "./perception-runtime.js";
import { RuntimeRestorationArtifactWriter } from "./runtime-restoration-executor.js";
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
import type { RestorationExecutionAuthorization } from "./execution-authorization.js";
import type { RestorationCandidate } from "./types.js";

class MemoryStore implements RestorationArtifactStore {
  readonly artifacts = new Map<string, StoredRestorationArtifact>();
  readonly cases = new Map<string, RestorationCase>();
  async putImmutableSource(input: { ownerUserId:string; caseId:string; artifactId:string; fileName:string; mimeType:string; sha256:string; bytes:Uint8Array }) {
    return { storageUri:`memory://${input.artifactId}`, runtimeUri:`https://runtime.test/${input.artifactId}` };
  }
  async putDerived(input: { ownerUserId:string; caseId:string; artifactId:string; parentArtifactId:string; fileName:string; mimeType:string; sha256:string; bytes:Uint8Array; role?:string }) {
    return { storageUri:`memory://${input.artifactId}`, runtimeUri:`https://runtime.test/${input.artifactId}` };
  }
  async resolveRuntimeUri(_ownerUserId:string,artifactId:string){ return `https://runtime.test/${artifactId}`; }
  async registerCase(value:RestorationCase){ this.cases.set(value.id,value); }
  async register(value:StoredRestorationArtifact){ this.artifacts.set(value.id,value); }
  async get(_ownerUserId:string,artifactId:string){ return this.artifacts.get(artifactId); }
}

function runtime(overrides:Partial<RestorationRuntimeClient>={}):RestorationRuntimeClient {
  return {
    async probe(source:RestorationRuntimeSource):Promise<RestorationProbeReceipt>{
      return {
        sourceArtifactId:source.artifactId,sourceSha256:source.sha256,codec:"flac",sampleRate:48000,channels:2,
        sampleCount:96000,durationSeconds:2,bitDepth:24,lossless:true,runtimeReceiptId:"probe-1",
      };
    },
    async separate():Promise<RestorationSeparationReceipt>{ throw new Error("not configured"); },
    async perceive():Promise<RestorationPerceptionReceipt>{ throw new Error("not configured"); },
    async execute():Promise<RestorationRepairReceipt>{ throw new Error("not configured"); },
    async reconstruct():Promise<RestorationReconstructionReceipt>{ throw new Error("not configured"); },
    async downloadArtifact(){ throw new Error("not configured"); },
    ...overrides,
  };
}

describe("restoration runtime spine",()=>{
  it("hashes, probes, persists and creates an immutable restoration case",async()=>{
    const store=new MemoryStore();
    const bytes=new TextEncoder().encode("canonical-audio");
    const result=await ingestRestorationSource({
      ownerUserId:"user-1",caseId:"case-1",fileName:"take.flac",mimeType:"audio/flac",bytes,
      runtime:runtime(),store,now:"2026-09-29T00:00:00.000Z",
    });
    expect(result.artifact.kind).toBe("source");
    expect(result.artifact.contentHash).toBe(await sha256Hex(bytes));
    expect(result.fingerprint.sampleRateHz).toBe(48000);
    expect(store.cases.get("case-1")?.sourceVersionId).toBe("case-1:v1");
    expect(store.artifacts.get(result.artifact.id)?.storageUri).toContain("memory://");
  });

  it("re-hashes separated bytes before admitting stems",async()=>{
    const store=new MemoryStore();
    const sourceBytes=new TextEncoder().encode("source");
    const sourceHash=await sha256Hex(sourceBytes);
    const source:StoredRestorationArtifact={
      id:"source-1",kind:"source",contentHash:sourceHash,sampleRate:48000,channels:2,sampleCount:48000,
      createdAt:"2026-09-29T00:00:00.000Z",ownerUserId:"user-1",caseId:"case-1",storageUri:"memory://source",
      mimeType:"audio/flac",sizeBytes:sourceBytes.length,
    };
    store.artifacts.set(source.id,source);
    const stemBytes=new TextEncoder().encode("vocals");
    const stemHash=await sha256Hex(stemBytes);
    const separated=await separateRestorationSource({
      ownerUserId:"user-1",caseId:"case-1",source,store,jobId:"job-1",
      runtime:runtime({
        async separate(){ return {
          jobId:"job-1",sourceArtifactId:"source-1",sourceSha256:sourceHash,modelId:"htdemucs",modelVersion:"4.0.1",
          runtimeReceiptId:"sep-1",stems:[{
            artifactId:"stem-vocals",parentArtifactId:"source-1",role:"vocals",resultUri:"/vocals.wav",sha256:stemHash,
            sampleRate:48000,channels:2,sampleCount:48000,durationSeconds:1,modelId:"htdemucs",modelVersion:"4.0.1",
            confidence:0.85,runtimeReceiptId:"stem-1",
          }],
        }; },
        async downloadArtifact(){ return stemBytes; },
      }),
    });
    expect(separated.artifacts[0]?.contentHash).toBe(stemHash);
    expect(separated.decomposition.nodes.find(node=>node.id==="stem-vocals")?.canonicalSource).toBe(false);
  });

  it("normalizes provider perception into descriptive evidence and structure",async()=>{
    const store=new MemoryStore();
    const artifact:StoredRestorationArtifact={
      id:"stem-vocals",kind:"derived",contentHash:"a".repeat(64),sampleRate:48000,channels:2,sampleCount:96000,
      parentArtifactId:"source-1",createdAt:"2026-09-29T00:00:00.000Z",ownerUserId:"user-1",caseId:"case-1",
      storageUri:"memory://vocals",mimeType:"audio/wav",sizeBytes:100,role:"vocals",
    };
    store.artifacts.set(artifact.id,artifact);
    const result=await perceiveRestorationArtifact({
      ownerUserId:"user-1",artifact,store,role:"vocals",
      runtime:runtime({
        async perceive(){ return {
          sourceArtifactId:"stem-vocals",sourceSha256:"a".repeat(64),sampleRate:48000,sampleCount:96000,tempoBpm:120,
          beatSamples:[0,24000,48000,72000],downbeatSamples:[0],sections:[{startSample:0,endSample:96000,label:"section-1",confidence:0.6}],
          transients:[{sample:24000,strength:1,confidence:0.8}],spectralCentroidHz:2000,rms:0.2,role:"vocals",
          vocal:{voicedFraction:0.7,medianF0Hz:220,confidence:0.8},
          confidences:{tempo:0.8,beat:0.8,downbeat:0.5,section:0.6},providerId:"librosa",providerVersion:"0.11.0",
          runtimeReceiptId:"perception-1",
        }; },
      }),
    });
    expect(result.structure.tempoBpm).toBe(120);
    expect(result.evidence.some(item=>item.kind==="music.transient")).toBe(true);
    expect(result.evidence.some(item=>item.kind==="music.vocal-activity")).toBe(true);
  });

  it("executes only admitted repairs and verifies returned bytes",async()=>{
    const store=new MemoryStore();
    const outputBytes=new TextEncoder().encode("repaired");
    const outputHash=await sha256Hex(outputBytes);
    const source:StoredRestorationArtifact={
      id:"source-1",kind:"source",contentHash:"b".repeat(64),sampleRate:48000,channels:2,sampleCount:48000,
      createdAt:"2026-09-29T00:00:00.000Z",ownerUserId:"user-1",caseId:"case-1",storageUri:"memory://source",
      mimeType:"audio/wav",sizeBytes:100,
    };
    store.artifacts.set(source.id,source);
    const candidate:RestorationCandidate={
      id:"candidate-1",operation:"gain",operationClass:"correction",status:"rendered",inputArtifactId:"source-1",
      parameters:{gainDb:-1},evidenceIds:["e1"],provenance:"derived",
    };
    const authorization:RestorationExecutionAuthorization={
      id:"auth-1",planId:"plan-1",candidateId:"candidate-1",sourceArtifactId:"source-1",decision:"restore",
      authorized:true,requiresHumanReview:false,gateReason:"allowed",evidenceIds:["e1"],reasons:[],
    };
    const writer=new RuntimeRestorationArtifactWriter({
      ownerUserId:"user-1",caseId:"case-1",executionId:"exec-1",candidate,source,store,
      runtime:runtime({
        async execute(){ return {
          executionId:"exec-1",sourceArtifactId:"source-1",outputArtifactId:"output-1",resultUri:"/output.wav",
          outputSha256:outputHash,sampleRate:48000,channels:2,sampleCount:48000,durationSeconds:1,operation:"gain",
          runtimeReceiptId:"repair-1",
        }; },
        async downloadArtifact(){ return outputBytes; },
      }),
      now:"2026-09-29T00:00:01.000Z",
    });
    const artifact=await writer.write({authorization});
    expect(artifact.id).toBe("output-1");
    expect(artifact.contentHash).toBe(outputHash);
    expect(store.artifacts.get("output-1")?.parentArtifactId).toBe("source-1");
  });
});

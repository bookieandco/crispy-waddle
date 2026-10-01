import { describe, expect, it } from "vitest";
import { RuntimeRestorationArtifactWriter } from "./runtime-restoration-executor.js";
import type { RestorationArtifactStore, StoredRestorationArtifact } from "./ingest-runtime.js";
import type { RestorationRuntimeClient } from "./runtime-contract.js";
import type { RestorationExecutionAuthorization } from "./execution-authorization.js";
import type { RestorationCandidate } from "./types.js";

const source:StoredRestorationArtifact={
  id:"source-1",kind:"source",contentHash:"a".repeat(64),sampleRate:48000,channels:2,sampleCount:48000,
  createdAt:"2026-10-01T00:00:00.000Z",ownerUserId:"user-1",caseId:"case-1",
  storageUri:"memory://source",mimeType:"audio/wav",sizeBytes:100,
};
const authorization:RestorationExecutionAuthorization={
  id:"auth-1",planId:"plan-1",candidateId:"candidate-1",sourceArtifactId:"source-1",decision:"restore",
  authorized:true,requiresHumanReview:false,gateReason:"allowed",evidenceIds:["band-limit-e1"],reasons:[],
};

function store():RestorationArtifactStore{
  return {
    async resolveRuntimeUri(){ return "https://runtime.test/source-1"; },
    async get(){ return undefined; },
  } as unknown as RestorationArtifactStore;
}

describe("spectral recovery provenance",()=>{
  it("rejects spectral recovery unless the candidate is source-recovery + reconstructed",async()=>{
    const candidate:RestorationCandidate={
      id:"candidate-1",operation:"spectral-recovery",operationClass:"correction",status:"rendered",
      inputArtifactId:"source-1",parameters:{detectedCutoffHz:8000,analysisConfidence:0.8},
      evidenceIds:["band-limit-e1"],provenance:"derived",
    };
    const writer=new RuntimeRestorationArtifactWriter({
      ownerUserId:"user-1",caseId:"case-1",executionId:"exec-1",candidate,source,store:store(),
      runtime:{} as RestorationRuntimeClient,
    });
    await expect(writer.write({authorization})).rejects.toThrow("source-recovery");
  });

  it("rejects a worker receipt that relabels synthesized high frequencies as original",async()=>{
    const candidate:RestorationCandidate={
      id:"candidate-1",operation:"spectral-recovery",operationClass:"source-recovery",status:"rendered",
      inputArtifactId:"source-1",parameters:{detectedCutoffHz:8000,analysisConfidence:0.8},
      evidenceIds:["band-limit-e1"],provenance:"reconstructed",
    };
    const runtime={
      async execute(){
        return {
          executionId:"exec-1",sourceArtifactId:"source-1",outputArtifactId:"output-1",resultUri:"/output.wav",
          outputSha256:"b".repeat(64),sampleRate:48000,channels:2,sampleCount:48000,durationSeconds:1,
          operation:"spectral-recovery" as const,
          diagnostics:{sourceRecovery:true,reconstructedHighFrequency:true,authenticatedOriginalContent:true},
          runtimeReceiptId:"repair-1",
        };
      },
    } as unknown as RestorationRuntimeClient;
    const writer=new RuntimeRestorationArtifactWriter({
      ownerUserId:"user-1",caseId:"case-1",executionId:"exec-1",candidate,source,store:store(),runtime,
    });
    await expect(writer.write({authorization})).rejects.toThrow("reconstruction provenance");
  });
});

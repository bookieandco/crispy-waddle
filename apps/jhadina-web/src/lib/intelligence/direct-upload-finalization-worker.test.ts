import { describe, expect, it } from "vitest";
import {
  GovernedAssetRegistry,
  InMemoryIntelligenceAssetStore,
  type PerceptionJob,
} from "@jhadina/intelligence-core";
import {
  DirectUploadFinalizationWorker,
  type DirectUploadFinalizeSessionStore,
} from "./direct-upload-finalization-worker";

const baseSession:any = {
  id:"s1",actorId:"u1",quarantinePath:"quarantine/u1/s1/fight.mp4",
  filename:"fight.mp4",declaredMediaType:"video/mp4",modality:"video",
  expectedByteLength:100,privacyClass:"sensitive",status:"finalizing",
  expiresAt:"2026-09-20T08:00:00Z",finalizeRequestedAt:"2026-09-20T06:00:00Z",
  finalizeAvailableAt:"2026-09-20T06:00:00Z",finalizeAttempt:1,finalizeMaxAttempts:4,
  finalizeLeaseOwner:"w",finalizeLeaseToken:"t",finalizeLeaseExpiresAt:"2026-09-20T07:00:00Z",
  cleanupStatus:"none",cleanupAvailableAt:"2026-09-20T06:00:00Z",cleanupAttempt:0,
  createdAt:"2026-09-20T05:00:00Z",updatedAt:"2026-09-20T06:00:00Z",
};

function store(overrides:any = {}): DirectUploadFinalizeSessionStore {
  return {
    async claimNextFinalize(){return baseSession},
    async renewFinalizeLease(){return baseSession},
    async recordScan(input:any){return {...baseSession,scanSha256:input.sha256,scanAt:input.scannedAt}},
    async complete(input:any){return {...baseSession,status:"finalized",assetId:input.assetId,perceptionJobId:input.perceptionJobId}},
    async retryFinalize(input:any){return {...baseSession,status:"finalize_retry",lastError:input.error,finalizeAvailableAt:input.availableAt}},
    async reject(input:any){return {...baseSession,status:"rejected",lastError:input.error,cleanupStatus:"pending"}},
    async claimNextCleanup(){return undefined},
    async completeCleanup(){return undefined},
    async retryCleanup(){return undefined},
    ...overrides,
  };
}

function jobs() {
  return {
    async enqueue(input:any):Promise<PerceptionJob>{
      return {
        id:input.id,actorId:input.actorId,assetId:input.assetId,status:"queued",
        attempt:0,maxAttempts:input.maxAttempts,availableAt:"2026-09-20T06:00:00Z",
        createdAt:"2026-09-20T06:00:00Z",updatedAt:"2026-09-20T06:00:00Z",
      };
    },
    async get(){return undefined},
  } as any;
}

describe("DirectUploadFinalizationWorker",()=>{
  it("scans, promotes, registers, enqueues perception, and finalizes under a lease",async()=>{
    let promoted=false;
    const worker=new DirectUploadFinalizationWorker(
      {async scan(input){return{assetId:input.assetId,sha256:"a".repeat(64),verdict:"clean",mimeType:input.mimeType,sizeBytes:input.sizeBytes,reasons:[],scannedAt:"2026-09-20T06:01:00Z"}}},
      store(),
      {
        async inspect(path){return{path,sizeBytes:100,mediaType:"video/mp4"}},
        async scanUri(){return"signed"},
        async removeQuarantine(){},
      },
      {async promote(){promoted=true;return{assetRef:"supabase://jhadina-intake-private/trusted/u1/s1/fight.mp4"}}},
      new GovernedAssetRegistry(new InMemoryIntelligenceAssetStore(),()=>new Date("2026-09-20T06:02:00Z")),
      jobs(),"w","sensitive",60000,
    );
    const out=await worker.runFinalizeNext();
    expect(out.state).toBe("finalized");
    expect(promoted).toBe(true);
  });

  it("rejects integrity mismatches and schedules cleanup",async()=>{
    let rejected=false;
    const worker=new DirectUploadFinalizationWorker(
      {async scan(){throw new Error("must not scan")}},
      store({async reject(input:any){rejected=true;return{...baseSession,status:"rejected",lastError:input.error,cleanupStatus:"pending"}}}),
      {
        async inspect(path){return{path,sizeBytes:99,mediaType:"video/mp4"}},
        async scanUri(){return"signed"},
        async removeQuarantine(){},
      },
      {async promote(){throw new Error("must not promote")}},
      new GovernedAssetRegistry(new InMemoryIntelligenceAssetStore()),
      jobs(),"w","sensitive",60000,
    );
    const out=await worker.runFinalizeNext();
    expect(out.state).toBe("rejected");
    expect(rejected).toBe(true);
  });

  it("retries transient scanner failures instead of rejecting",async()=>{
    let retried=false;
    const worker=new DirectUploadFinalizationWorker(
      {async scan(){throw new Error("MEDIA_SCANNER_HTTP_503")}},
      store({async retryFinalize(input:any){retried=true;return{...baseSession,status:"finalize_retry",lastError:input.error,finalizeAvailableAt:input.availableAt}}}),
      {
        async inspect(path){return{path,sizeBytes:100,mediaType:"video/mp4"}},
        async scanUri(){return"signed"},
        async removeQuarantine(){},
      },
      {async promote(){throw new Error("unreachable")}},
      new GovernedAssetRegistry(new InMemoryIntelligenceAssetStore()),
      jobs(),"w","sensitive",60000,()=>new Date("2026-09-20T06:00:00Z"),
    );
    const out=await worker.runFinalizeNext();
    expect(out.state).toBe("retry_wait");
    expect(retried).toBe(true);
  });

  it("removes rejected/expired quarantine objects through cleanup lease",async()=>{
    let removed="";
    const cleanup={...baseSession,status:"rejected",cleanupStatus:"running",cleanupAttempt:1,cleanupLeaseToken:"ct",cleanupLeaseOwner:"w",cleanupLeaseExpiresAt:"2026-09-20T07:00:00Z"};
    const worker=new DirectUploadFinalizationWorker(
      {async scan(){throw new Error("unreachable")}},
      store({
        async claimNextFinalize(){return undefined},
        async claimNextCleanup(){return cleanup},
        async completeCleanup(){return{...cleanup,cleanupStatus:"cleaned"}},
      }),
      {
        async inspect(){return undefined},
        async scanUri(){return"signed"},
        async removeQuarantine(path){removed=path},
      },
      {async promote(){throw new Error("unreachable")}},
      new GovernedAssetRegistry(new InMemoryIntelligenceAssetStore()),
      jobs(),"w","sensitive",60000,
    );
    const out=await worker.runCleanupNext();
    expect(out.state).toBe("cleaned");
    expect(removed).toBe(cleanup.quarantinePath);
  });
});

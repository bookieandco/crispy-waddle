import { describe, expect, it } from "vitest";
import type { PerceptionJob } from "@jhadina/intelligence-core";
import { PerceptionJobWorker } from "./perception-job-worker";

const claimed:PerceptionJob = {
  id:"perception:u:a",actorId:"u",assetId:"a",status:"running",
  attempt:1,maxAttempts:4,availableAt:"2026-09-19T00:00:00Z",
  leaseOwner:"w",leaseToken:"t",leaseExpiresAt:"2026-09-19T01:00:00Z",
  createdAt:"2026-09-19T00:00:00Z",updatedAt:"2026-09-19T00:00:00Z",
};

function repository(overrides:any = {}) {
  return {
    async claimNext(){return claimed},
    async renewLease(){return claimed},
    async requireSelection(input:any){return {...claimed,status:"needs_selection",packet:input.packet}},
    async complete(input:any){return {...claimed,status:"completed",packet:input.packet,dispatch:input.dispatch}},
    async retry(input:any){return {...claimed,status:"retry_wait",lastError:input.error,availableAt:input.availableAt}},
    async fail(input:any){return {...claimed,status:"failed",lastError:input.error}},
    async enqueue(){return claimed},
    async requeueWithIntent(){return claimed},
    async get(){return claimed},
    ...overrides,
  } as any;
}

const asset:any = {
  id:"a",actorId:"u",modality:"video",mediaType:"video/mp4",assetRef:"trusted",
  privacyClass:"sensitive",status:"registered",createdAt:"2026-09-19T00:00:00Z",
};

describe("PerceptionJobWorker", () => {
  it("completes perception and subsystem dispatch under one lease", async () => {
    const jobs = repository();
    const worker = new PerceptionJobWorker(
      jobs,
      { async get(){return asset} },
      { async process(){return {asset,evidence:[],uncertainty:[],routing:{assetId:"a",routes:[],requiresHumanSelection:false}} as any} },
      { async dispatch(){return {assetId:"a",responses:[],skipped:[]}} } as any,
      "w",
      60_000,
    );
    const out = await worker.runNext();
    expect(out.state).toBe("completed");
    if (out.state === "completed") expect(out.job.status).toBe("completed");
  });

  it("persists human selection instead of dispatching ambiguous routes", async () => {
    let dispatched = false;
    const worker = new PerceptionJobWorker(
      repository(),
      { async get(){return asset} },
      { async process(){return {asset,evidence:[],uncertainty:[],routing:{assetId:"a",routes:[{subsystem:"sports-intelligence",reason:"x",confidence:.8},{subsystem:"director-studio",reason:"y",confidence:.8}],requiresHumanSelection:true}} as any} },
      { async dispatch(){dispatched=true;throw new Error("must not run")} } as any,
      "w",
      60_000,
    );
    const out = await worker.runNext();
    expect(out.state).toBe("needs_selection");
    expect(dispatched).toBe(false);
  });

  it("retries transient worker errors with backoff", async () => {
    let retry:any;
    const jobs = repository({async retry(input:any){retry=input;return {...claimed,status:"retry_wait",availableAt:input.availableAt,lastError:input.error}}});
    const worker = new PerceptionJobWorker(
      jobs,
      { async get(){return asset} },
      { async process(){throw new Error("PERCEPTION_WORKER_HTTP_503")} },
      { async dispatch(){throw new Error("unreachable")} } as any,
      "w",
      60_000,
      () => new Date("2026-09-19T00:00:00Z"),
    );
    const out = await worker.runNext();
    expect(out.state).toBe("retry_wait");
    expect(retry.availableAt).toBe("2026-09-19T00:00:05.000Z");
  });

  it("fails terminal provenance mismatches without retrying", async () => {
    let failed = false;
    let retried = false;
    const jobs = repository({
      async fail(input:any){failed=true;return {...claimed,status:"failed",lastError:input.error}},
      async retry(){retried=true;return claimed},
    });
    const worker = new PerceptionJobWorker(
      jobs,
      { async get(){return asset} },
      { async process(){throw new Error("PERCEPTION_WORKER_HASH_MISMATCH")} },
      { async dispatch(){throw new Error("unreachable")} } as any,
      "w",
      60_000,
    );
    const out = await worker.runNext();
    expect(out.state).toBe("failed");
    expect(failed).toBe(true);
    expect(retried).toBe(false);
  });
});

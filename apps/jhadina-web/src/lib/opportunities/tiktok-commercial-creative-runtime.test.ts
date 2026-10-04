import { describe, expect, it, vi } from "vitest";
import {
  createRunpodServerlessExecutor,
  resolveTikTokCommercialCreativeExecutor,
} from "./tiktok-commercial-creative-runtime";

const qc = {
  id: "qc:1",
  productRef: "product-1",
  status: "pass" as const,
  reasons: [],
  truthMatchedAssertionRefs: ["color:primary:blue"],
  approvedClaimRefs: ["claim:1"],
  approvedOfferRefs: ["offer:1"],
  evidenceIds: ["evidence:qc"],
  evaluatedAt: "2026-10-04T10:00:00Z",
  publicationAuthorized: false as const,
  moneyMovementAuthorized: false as const,
};

const request = {
  jobId: "job:1",
  projectId: "project:1",
  productRef: "product-1",
  qc,
  prompt: "Show the exact product on a clean table with a slow orbit camera.",
  referenceAssetUris: ["asset://product-1"],
  durationSeconds: 10,
  aspectRatio: "9:16" as const,
  maxCostUsd: 1,
  evidenceRefs: ["evidence:qc"],
};

describe("TikTok commercial creative runtime", () => {
  it("uses local-first resolution before RunPod", () => {
    const executor = resolveTikTokCommercialCreativeExecutor({
      TIKTOK_COMMERCIAL_LOCAL_WORKER_URL: "http://localhost:8188",
      TIKTOK_COMMERCIAL_RUNPOD_ENDPOINT_ID: "endpoint-1",
      RUNPOD_API_KEY: "secret",
    } as NodeJS.ProcessEnv);
    expect(executor?.kind).toBe("local_worker");
  });

  it("executes through RunPod Serverless without granting publish authority", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({
        id: "runpod-job-1",
        status: "COMPLETED",
        output: {
          assetUri: "https://cdn.example.test/output.mp4",
          costUsd: 0.42,
        },
      }), { status: 200 }),
    ) as unknown as typeof fetch;

    const executor = createRunpodServerlessExecutor({
      endpointId: "endpoint-1",
      apiKey: "secret",
      fetchImpl,
    });
    const receipt = await executor.execute(request);
    expect(receipt.status).toBe("ready");
    expect(receipt.artifactUri).toContain("output.mp4");
    expect(receipt.publicationAuthority).toBe("NO_PUBLISH_AUTHORITY");

    const url = String(fetchImpl.mock.calls[0]![0]);
    expect(url).toContain("/v2/endpoint-1/runsync");
    const init = fetchImpl.mock.calls[0]![1] as RequestInit;
    expect(String((init.headers as Record<string, string>).authorization)).toContain("secret");
    expect(JSON.stringify(init.body)).not.toContain("secret");
  });

  it("rejects generation when final QC is blocked", async () => {
    const executor = createRunpodServerlessExecutor({
      endpointId: "endpoint-1",
      apiKey: "secret",
      fetchImpl: vi.fn(),
    });
    await expect(executor.execute({
      ...request,
      qc: { ...qc, status: "blocked", reasons: ["bad"] },
    })).rejects.toThrow(/QC_PASS_REQUIRED/);
  });
});

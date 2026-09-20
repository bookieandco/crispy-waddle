import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  GovernedAssetRegistry,
  InMemoryIntelligenceAssetStore,
  perceptionJobId,
} from "@jhadina/intelligence-core";
import { UniversalUploadRuntime } from "./production-universal-upload-runtime";
import type { UniversalUploadObjectStore } from "./supabase-universal-upload-store";

const bytes = new TextEncoder().encode("%PDF-1.7\ncounty surplus");

function runtime(verdict: "clean" | "quarantine" = "clean") {
  let promoted = false;
  let enqueued:any;
  const hash = createHash("sha256").update(bytes).digest("hex");
  const objects: UniversalUploadObjectStore = {
    async putQuarantine() {
      return { handle: "quarantine/u/1/list.pdf", scanUri: "https://signed.test" };
    },
    async promote() {
      promoted = true;
      return { assetRef: "supabase://bucket/trusted/u/1/list.pdf" };
    },
  };
  const registry = new GovernedAssetRegistry(new InMemoryIntelligenceAssetStore());
  const jobs:any = {
    async enqueue(input:any) {
      enqueued = input;
      return {
        id: input.id,
        actorId: input.actorId,
        assetId: input.assetId,
        intent: input.intent,
        status: "queued",
        attempt: 0,
        maxAttempts: input.maxAttempts,
        availableAt: "2026-09-19T00:00:00Z",
        createdAt: "2026-09-19T00:00:00Z",
        updatedAt: "2026-09-19T00:00:00Z",
      };
    },
  };
  const upload = new UniversalUploadRuntime(
    {
      async scan(input) {
        return {
          assetId: input.assetId,
          sha256: hash,
          verdict,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
          reasons: verdict === "clean" ? [] : ["scanner review"],
          scannedAt: "2026-09-19T00:00:00Z",
        };
      },
    },
    objects,
    registry,
    jobs,
  );
  return { upload, wasPromoted: () => promoted, enqueued: () => enqueued };
}

describe("UniversalUploadRuntime", () => {
  it("returns after clean promotion, registration, and durable job enqueue", async () => {
    const fixture = runtime();
    const result = await fixture.upload.ingest({
      actorId: "u",
      filename: "county-surplus.pdf",
      declaredMediaType: "application/pdf",
      bytes,
      privacyClass: "sensitive",
      intent: "analyze this overage list",
    });

    expect(fixture.wasPromoted()).toBe(true);
    expect(result.asset.contentSha256).toHaveLength(64);
    expect(result.job.status).toBe("queued");
    expect(result.job.id).toBe(perceptionJobId("u", result.asset.id));
    expect(fixture.enqueued().intent).toBe("analyze this overage list");
  });

  it("leaves a non-clean upload quarantined and never enqueues perception", async () => {
    const fixture = runtime("quarantine");
    await expect(fixture.upload.ingest({
      actorId: "u",
      filename: "county-surplus.pdf",
      declaredMediaType: "application/pdf",
      bytes,
      privacyClass: "sensitive",
    })).rejects.toThrow("MEDIA_SECURITY_QUARANTINE");
    expect(fixture.wasPromoted()).toBe(false);
    expect(fixture.enqueued()).toBeUndefined();
  });

  it("blocks restricted uploads before quarantine when scanner ceiling is sensitive", async () => {
    let quarantined = false;
    const hash = createHash("sha256").update(bytes).digest("hex");
    const objects: UniversalUploadObjectStore = {
      async putQuarantine() {
        quarantined = true;
        return { handle: "q", scanUri: "signed" };
      },
      async promote() { return { assetRef: "trusted" }; },
    };
    const upload = new UniversalUploadRuntime(
      {
        async scan(input) {
          return {
            assetId: input.assetId,
            sha256: hash,
            verdict: "clean",
            mimeType: input.mimeType,
            sizeBytes: input.sizeBytes,
            reasons: [],
            scannedAt: "2026-09-19T00:00:00Z",
          };
        },
      },
      objects,
      new GovernedAssetRegistry(new InMemoryIntelligenceAssetStore()),
      { async enqueue(){throw new Error("must not enqueue")} } as any,
      "sensitive",
    );

    await expect(upload.ingest({
      actorId: "u",
      filename: "secret.pdf",
      declaredMediaType: "application/pdf",
      bytes,
      privacyClass: "restricted",
    })).rejects.toThrow("SCANNER_PRIVACY_INCOMPATIBLE");
    expect(quarantined).toBe(false);
  });
});

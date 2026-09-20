import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  DocumentPerceptionExtractor,
  GovernedAssetRegistry,
  GovernedMediaPipeline,
  GovernedPerceptionExtractionRouter,
  GovernedSubsystemDispatcher,
  GovernedUniversalIntakeRouter,
  InMemoryIntelligenceAssetStore,
  type MediaExtractionBackend,
} from "@jhadina/intelligence-core";
import { UniversalUploadRuntime } from "./production-universal-upload-runtime";
import type { UniversalUploadObjectStore } from "./supabase-universal-upload-store";

const bytes = new TextEncoder().encode("%PDF-1.7\ncounty surplus");

function runtime(verdict: "clean" | "quarantine" = "clean") {
  let promoted = false;
  const hash = createHash("sha256").update(bytes).digest("hex");
  const objects: UniversalUploadObjectStore = {
    async putQuarantine() { return { handle: "quarantine/u/1/list.pdf", scanUri: "https://signed.test" }; },
    async promote() { promoted = true; return { assetRef: "supabase://bucket/trusted/u/1/list.pdf" }; },
  };
  const registry = new GovernedAssetRegistry(new InMemoryIntelligenceAssetStore());
  const backend: MediaExtractionBackend = {
    async extract() {
      return { observations: [{ kind: "page", summary: "county surplus source" }], uncertainty: [] };
    },
  };
  const media = new GovernedMediaPipeline(
    new GovernedPerceptionExtractionRouter([new DocumentPerceptionExtractor(backend)]),
    new GovernedUniversalIntakeRouter(),
  );
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
    media,
    new GovernedSubsystemDispatcher([]),
  );
  return { upload, wasPromoted: () => promoted };
}

describe("UniversalUploadRuntime", () => {
  it("promotes only after a clean scan and routes the registered asset", async () => {
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
    expect(result.packet.routing.routes.some((route) => route.subsystem === "overageos")).toBe(true);
    expect(result.dispatch.skipped).toContain("overageos");
  });

  it("leaves a non-clean upload quarantined and never promotes it", async () => {
    const fixture = runtime("quarantine");
    await expect(fixture.upload.ingest({
      actorId: "u",
      filename: "county-surplus.pdf",
      declaredMediaType: "application/pdf",
      bytes,
      privacyClass: "sensitive",
    })).rejects.toThrow("MEDIA_SECURITY_QUARANTINE");
    expect(fixture.wasPromoted()).toBe(false);
  });
  it("blocks restricted uploads before quarantine when scanner ceiling is sensitive", async () => {
    let quarantined = false;
    const hash = createHash("sha256").update(bytes).digest("hex");
    const objects: UniversalUploadObjectStore = {
      async putQuarantine() { quarantined = true; return { handle: "q", scanUri: "signed" }; },
      async promote() { return { assetRef: "trusted" }; },
    };
    const registry = new GovernedAssetRegistry(new InMemoryIntelligenceAssetStore());
    const backend: MediaExtractionBackend = {
      async extract() { return { observations: [{ kind: "page", summary: "x" }], uncertainty: [] }; },
    };
    const upload = new UniversalUploadRuntime(
      { async scan(input) { return { assetId: input.assetId, sha256: hash, verdict: "clean", mimeType: input.mimeType, sizeBytes: input.sizeBytes, reasons: [], scannedAt: "2026-09-19T00:00:00Z" }; } },
      objects,
      registry,
      new GovernedMediaPipeline(
        new GovernedPerceptionExtractionRouter([new DocumentPerceptionExtractor(backend)]),
        new GovernedUniversalIntakeRouter(),
      ),
      new GovernedSubsystemDispatcher([]),
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

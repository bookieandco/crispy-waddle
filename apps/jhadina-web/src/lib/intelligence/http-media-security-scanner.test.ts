import { describe, expect, it } from "vitest";
import { HttpMediaSecurityScanner } from "./http-media-security-scanner";

describe("HttpMediaSecurityScanner", () => {
  it("accepts a bound clean scanner result", async () => {
    const scanner = new HttpMediaSecurityScanner("https://scanner.test", undefined, async () =>
      new Response(JSON.stringify({
        assetId: "q1",
        sha256: "a".repeat(64),
        verdict: "clean",
        mimeType: "video/mp4",
        sizeBytes: 10,
        reasons: [],
        scannedAt: "2026-09-19T00:00:00Z",
      }), { status: 200, headers: { "content-type": "application/json" } })
    );
    const result = await scanner.scan({ assetId: "q1", uri: "signed", mimeType: "video/mp4", sizeBytes: 10 });
    expect(result.verdict).toBe("clean");
  });

  it("rejects a scanner response for another asset", async () => {
    const scanner = new HttpMediaSecurityScanner("https://scanner.test", undefined, async () =>
      new Response(JSON.stringify({
        assetId: "other",
        sha256: "a".repeat(64),
        verdict: "clean",
        mimeType: "video/mp4",
        sizeBytes: 10,
        reasons: [],
        scannedAt: "2026-09-19T00:00:00Z",
      }), { status: 200 })
    );
    await expect(scanner.scan({ assetId: "q1", uri: "signed", mimeType: "video/mp4", sizeBytes: 10 }))
      .rejects.toThrow("ASSET_MISMATCH");
  });
});

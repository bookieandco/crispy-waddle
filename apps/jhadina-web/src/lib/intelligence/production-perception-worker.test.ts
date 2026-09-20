import { describe, expect, it } from "vitest";
import {
  HttpSemanticPerceptionBackend,
  perceptionOperationsFor,
} from "./production-perception-worker";

const input:any = {
  assetId: "a1",
  actorId: "u1",
  modality: "video",
  assetRef: "supabase://jhadina-intake-private/trusted/u1/x/v.mp4",
  mediaType: "video/mp4",
  privacyClass: "sensitive",
  contentSha256: "a".repeat(64),
  byteLength: 10,
};

describe("HttpSemanticPerceptionBackend", () => {
  it("requests video frames, scenes, transcript and audio features", () => {
    expect(perceptionOperationsFor("video")).toEqual([
      "video.frames", "video.scenes", "audio.transcript", "audio.features",
    ]);
    expect(perceptionOperationsFor("document")).toContain("document.tables");
    expect(perceptionOperationsFor("audio")).toContain("audio.beats");
  });

  it("binds worker output to the asset and marks summaries untrusted", async () => {
    let body:any;
    const backend = new HttpSemanticPerceptionBackend(
      "https://worker.test/perceive",
      { async signedReadUrl() { return "https://signed.test/v.mp4"; } },
      undefined,
      "sensitive",
      async (_url, init) => {
        body = JSON.parse(String(init?.body));
        return new Response(JSON.stringify({
          schema: "jhadina.perception-result.v1",
          assetId: "a1",
          contentSha256: "a".repeat(64),
          completedOperations: ["video.frames", "video.scenes", "audio.transcript", "audio.features"],
          observations: [{ kind: "video.scene", summary: "Boxer circles clockwise." }],
          uncertainty: ["rear hand partially occluded"],
        }), { status: 200, headers: { "content-type": "application/json" } });
      },
    );

    const out = await backend.extract(input);
    expect(body.operations).toContain("audio.transcript");
    expect(body.asset.uri).toBe("https://signed.test/v.mp4");
    expect(out.observations[0].summary).toContain("[UNTRUSTED_ASSET_CONTENT]");
  });

  it("rejects mismatched worker asset identity", async () => {
    const backend = new HttpSemanticPerceptionBackend(
      "https://worker.test",
      { async signedReadUrl() { return "signed"; } },
      undefined,
      "sensitive",
      async () => new Response(JSON.stringify({
        schema: "jhadina.perception-result.v1",
        assetId: "other",
        completedOperations: ["video.frames", "video.scenes", "audio.transcript", "audio.features"],
        observations: [],
      }), { status: 200 }),
    );
    await expect(backend.extract(input)).rejects.toThrow("ASSET_MISMATCH");
  });

  it("blocks restricted content before creating a signed read URL", async () => {
    let resolved = false;
    const backend = new HttpSemanticPerceptionBackend(
      "https://worker.test",
      { async signedReadUrl() { resolved = true; return "signed"; } },
      undefined,
      "sensitive",
      async () => { throw new Error("must not call"); },
    );
    await expect(backend.extract({ ...input, privacyClass: "restricted" }))
      .rejects.toThrow("PRIVACY_INCOMPATIBLE");
    expect(resolved).toBe(false);
  });
  it("rejects a worker that silently skips requested operations", async () => {
    const backend = new HttpSemanticPerceptionBackend(
      "https://worker.test",
      { async signedReadUrl() { return "signed"; } },
      undefined,
      "sensitive",
      async () => new Response(JSON.stringify({
        schema: "jhadina.perception-result.v1",
        assetId: "a1",
        contentSha256: "a".repeat(64),
        completedOperations: ["video.frames"],
        observations: [],
      }), { status: 200 }),
    );
    await expect(backend.extract(input)).rejects.toThrow("PERCEPTION_WORKER_INCOMPLETE");
  });
});

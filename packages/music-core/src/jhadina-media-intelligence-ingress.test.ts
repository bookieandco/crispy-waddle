import { describe, expect, it } from "vitest";
import { JhadinaMediaIntelligenceAdapter } from "./jhadina-media-intelligence-ingress.js";
import { MusicPerceptionMemoryStore } from "./restoration-engine/music-perception-memory.js";

const request:any = {
  actorId: "user-1",
  assetId: "asset-1",
  evidence: [
    { id: "asset:asset-1:transcript:0", source: "perception:audio", observedAt: "2026-01-01T00:00:00Z", summary: "vocal phrase", immutable: true },
    { id: "asset:asset-1:beat:0", source: "perception:audio", observedAt: "2026-01-01T00:00:01Z", summary: "beat observation", immutable: true },
  ],
  uncertainty: ["instrument identity uncertain"],
  intent: "restore this recording",
};

describe("JhadinaMediaIntelligenceAdapter", () => {
  it("creates a source restoration case and source-specific perception memories", async () => {
    let registered:any;
    const memory = new MusicPerceptionMemoryStore();
    const adapter = new JhadinaMediaIntelligenceAdapter(
      { async register(input) { registered = input; return { receiptId: "music-r1" }; } },
      memory,
      () => new Date("2026-01-02T00:00:00Z"),
    );
    const out = await adapter.ingest(request);
    expect(registered.restorationCase.sourceVersionId).toBe("music-case:asset-1:v1");
    expect(registered.restorationCase.versions[0].inputArtifactId).toBe("asset-1");
    expect(memory.query({ sourceArtifactId: "asset-1" })).toHaveLength(2);
    expect(out.subsystem).toBe("jhadina-media");
    expect(out.receiptId).toBe("music-r1");
  });

  it("is idempotent for already imported evidence memories", async () => {
    const memory = new MusicPerceptionMemoryStore();
    const adapter = new JhadinaMediaIntelligenceAdapter(
      { async register() { return { receiptId: "r" }; } },
      memory,
    );
    await adapter.ingest(request);
    await adapter.ingest(request);
    expect(memory.query({ sourceArtifactId: "asset-1" })).toHaveLength(2);
  });

  it("rejects evidence from another asset", async () => {
    const adapter = new JhadinaMediaIntelligenceAdapter(
      { async register() { return { receiptId: "r" }; } },
      new MusicPerceptionMemoryStore(),
    );
    await expect(adapter.ingest({
      ...request,
      evidence: [{ ...request.evidence[0], id: "asset:other:beat:0" }],
    })).rejects.toThrow("EVIDENCE_NOT_ASSET_BOUND");
  });

  it("does not expose restoration or playback execution authority", () => {
    const adapter:any = new JhadinaMediaIntelligenceAdapter(
      { async register() { return { receiptId: "r" }; } },
      new MusicPerceptionMemoryStore(),
    );
    expect(adapter.restore).toBeUndefined();
    expect(adapter.master).toBeUndefined();
    expect(adapter.play).toBeUndefined();
    expect(adapter.execute).toBeUndefined();
    expect(adapter.approve).toBeUndefined();
  });
});

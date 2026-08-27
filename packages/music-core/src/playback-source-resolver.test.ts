import { describe, expect, it } from "vitest";
import { CompositePlaybackSourceResolver } from "./playback-source-resolver.js";
import type { MediaAsset, Track } from "./types.js";

const track = { id: "track-1", title: "Test", artistIds: ["artist-1"], albumId: undefined, durationMs: 120000 } as Track;
const asset = (id: string): MediaAsset => ({ id, kind: "stream", sourceId: "test", uri: `https://example.test/${id}`, mimeType: "audio/mpeg" } as MediaAsset);
const resolver = (result: MediaAsset | null) => ({ resolve: async () => result ? { track, asset: result, mode: "network" as const } : null });

describe("playback source resolver", () => {
  it("prefers an available offline asset", async () => {
    const result = await new CompositePlaybackSourceResolver(resolver(asset("offline")), [resolver(asset("network"))]).resolve({ track });
    expect(result?.asset.id).toBe("offline");
    expect(result?.mode).toBe("offline");
  });
  it("does not fall back to network in offline-only mode", async () => {
    const result = await new CompositePlaybackSourceResolver(undefined, [resolver(asset("network"))]).resolve({ track, offlineOnly: true });
    expect(result).toBeNull();
  });
  it("falls back across network providers", async () => {
    const result = await new CompositePlaybackSourceResolver(undefined, [resolver(null), resolver(asset("second"))]).resolve({ track });
    expect(result?.asset.id).toBe("second");
    expect(result?.mode).toBe("network");
  });
  it("returns null when no authorized source resolves", async () => {
    const result = await new CompositePlaybackSourceResolver(undefined, [resolver(null)]).resolve({ track });
    expect(result).toBeNull();
  });
});

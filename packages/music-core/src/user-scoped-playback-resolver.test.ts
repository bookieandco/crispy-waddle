import { describe, expect, it } from "vitest";
import { UserScopedPlaybackResolver } from "./user-scoped-playback-resolver.js";
import { InMemoryMusicRepository } from "./repository.js";
import type { MediaAsset, MusicSource, Track } from "./types.js";

const track: Track = { id: "t1", title: "Test", artistIds: ["a1"] };
const source: MusicSource = { id: "s1", userId: "u1", kind: "youtube_music", name: "YouTube Music", authorized: true, metadata: {} };
const asset = (kind: MediaAsset["kind"], provenance?: Record<string, unknown>): MediaAsset => ({ id: `${kind}-1`, trackId: "t1", sourceId: "s1", kind, uri: `https://example.test/${kind}`, provenance });

const setup = async () => { const repo = new InMemoryMusicRepository(); await repo.upsertTrack("u1", track); await repo.upsertSource(source); return repo; };

describe("user-scoped playback resolver", () => {
  it("requires the track to belong to the requesting user", async () => {
    const repo = await setup();
    const resolver = new UserScopedPlaybackResolver(repo, { resolve: async () => asset("stream") });
    expect(await resolver.resolve({ userId: "u2", track })).toBeNull();
  });
  it("rejects unauthorized sources", async () => {
    const repo = await setup();
    await repo.upsertSource({ ...source, authorized: false });
    const resolver = new UserScopedPlaybackResolver(repo, { resolve: async () => asset("stream") });
    expect(await resolver.resolve({ userId: "u1", track })).toBeNull();
  });
  it("prefers a verified offline asset", async () => {
    const repo = await setup();
    await repo.addAsset("u1", asset("file", { offline: true }));
    const resolver = new UserScopedPlaybackResolver(repo, { resolve: async () => { throw new Error("network should not be used"); } });
    expect((await resolver.resolve({ userId: "u1", track }))?.mode).toBe("offline");
  });
  it("honors offline-only when no offline asset exists", async () => {
    const repo = await setup();
    const resolver = new UserScopedPlaybackResolver(repo, { resolve: async () => asset("stream") });
    expect(await resolver.resolve({ userId: "u1", track, offlineOnly: true })).toBeNull();
  });
  it("accepts only an asset matching the authorized source and track", async () => {
    const repo = await setup();
    const resolver = new UserScopedPlaybackResolver(repo, { resolve: async () => ({ ...asset("stream"), sourceId: "other" }) });
    expect(await resolver.resolve({ userId: "u1", track })).toBeNull();
  });
});

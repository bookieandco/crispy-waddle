import { describe, expect, it, vi } from "vitest";
import { InMemoryMusicRepository } from "@jhadina/music-core";
import { resolveOwnedMusicStorage } from "./music-storage-playback";

async function setup(userId = "alice", bucket = "music-owned", path = "alice/audio.mp3") {
  const repo = new InMemoryMusicRepository();
  await repo.upsertTrack(userId, { id: "track1", title: "Demo", artistIds: [] });
  await repo.upsertSource({ id: "owned", userId, kind: "local", name: "Owned files", authorized: true, metadata: { rightsBasis: "owner" } });
  await repo.addAsset(userId, { id: "file", trackId: "track1", sourceId: "owned", kind: "file",
    uri: "https://storage.example.test/old-expired?token=old", provenance: {
      playbackAuthorized: true, storageBucket: bucket, storagePath: path,
      expiresAt: "2020-01-01T00:00:00Z",
    } });
  return repo;
}
describe("owned audio storage URL renewal", () => {
  it("signs only own object with short TTL, never the expired stored URL", async () => {
    const db = await setup();
    const sign = vi.fn(async () => "https://storage.example.test/renewed?token=fresh");
    const ticket = await resolveOwnedMusicStorage(db, "alice", "track1", { sign }, Date.parse("2026-10-09T12:00:00Z"));
    expect(sign).toHaveBeenCalledWith("music-owned", "alice/audio.mp3", 180);
    expect(ticket?.sourceUri).toContain("fresh");
    expect(ticket?.expiresAt).toBe("2026-10-09T12:03:00.000Z");
    expect(await resolveOwnedMusicStorage(db, "bob", "track1", { sign })).toBeNull();
  });
  it("refuses a cross-user path, unknown bucket or unapproved source without signing", async () => {
    const sign = vi.fn(async () => "https://storage.example.test/renewed?token=fresh");
    expect(await resolveOwnedMusicStorage(await setup("alice", "music-owned", "bob/song.mp3"), "alice", "track1", { sign })).toBeNull();
    expect(await resolveOwnedMusicStorage(await setup("alice", "unknown", "alice/song.mp3"), "alice", "track1", { sign })).toBeNull();
    expect(await resolveOwnedMusicStorage(await setup("alice", "music-owned", "alice/../bob/song.mp3"), "alice", "track1", { sign })).toBeNull();
    expect(sign).not.toHaveBeenCalled();
  });
});

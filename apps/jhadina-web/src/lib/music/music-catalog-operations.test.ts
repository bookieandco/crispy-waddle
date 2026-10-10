import { describe, expect, it } from "vitest";
import { InMemoryMusicRepository } from "@jhadina/music-core";
import { importYouTubeCatalog, resolveMusicPlayback, searchMusicCatalog } from "./music-catalog-operations";

const metadata = {
  sourceId: "youtube_music:catalog-a",
  tracks: [{
    videoId: "abcdEFGH123",
    title: "A Night in the City",
    artists: ["Atwood Bookie"],
    durationMs: 200000,
  }],
};

describe("Music catalog user isolation, provenance and playback", () => {
  it("makes the imported metadata searchable through the same repository without inventing rights", async () => {
    const repository = new InMemoryMusicRepository();
    await importYouTubeCatalog(repository, "alice", metadata);
    const found = await searchMusicCatalog(repository, "alice", "A Night");
    expect(found).toHaveLength(1);
    expect(found[0].track.title).toBe("A Night in the City");
    expect(await searchMusicCatalog(repository, "bob", "A Night")).toEqual([]);
    const sources = await repository.listSources("alice");
    expect(sources).toHaveLength(1);
    expect(sources[0].authorized).toBe(false);
    expect(sources[0].metadata.role).toBe("catalog-library");
    expect(await resolveMusicPlayback(repository, "alice", found[0].track.id)).toBeNull();
  });

  it("requires a separately admitted playable asset, user scope, and explicit rights evidence", async () => {
    const repository = new InMemoryMusicRepository();
    await importYouTubeCatalog(repository, "alice", metadata);
    const trackId = (await repository.listTracks("alice"))[0].id;
    await repository.upsertSource({
      id: "owned:master-1", userId: "alice", kind: "local", name: "Owned master",
      authorized: true, metadata: { rightsBasis: "owner-verified" },
    });
    await repository.addAsset("alice", {
      id: "owned:file-1", trackId, sourceId: "owned:master-1",
      kind: "file", uri: "https://audio.example.test/authorized-song.mp3",
      provenance: { playbackAuthorized: false },
    });
    expect(await resolveMusicPlayback(repository, "alice", trackId)).toBeNull();
    await repository.addAsset("alice", {
      id: "owned:file-1", trackId, sourceId: "owned:master-1",
      kind: "file", uri: "https://audio.example.test/authorized-song.mp3",
      provenance: { playbackAuthorized: true },
    });
    expect((await resolveMusicPlayback(repository, "alice", trackId))?.sourceUri)
      .toBe("https://audio.example.test/authorized-song.mp3");
    expect(await resolveMusicPlayback(repository, "bob", trackId)).toBeNull();
  });

  it("denies external references, unsafe playback schemes and expired authorizations", async () => {
    const repository = new InMemoryMusicRepository();
    await importYouTubeCatalog(repository, "alice", metadata);
    const trackId = (await repository.listTracks("alice"))[0].id;
    await repository.upsertSource({ id: "service", userId: "alice", kind: "authorized_service", name: "Provider", authorized: true, metadata: {} });
    for (const uri of ["javascript:alert(1)", "http://audio.example.test/a.mp3", "https://user:pass@audio.example.test/a.mp3"]) {
      await repository.addAsset("alice", { id: "asset", trackId, sourceId: "service", kind: "stream", uri, provenance: { playbackAuthorized: true } });
      expect(await resolveMusicPlayback(repository, "alice", trackId)).toBeNull();
    }
    await repository.addAsset("alice", { id: "asset", trackId, sourceId: "service", kind: "stream", uri: "https://audio.example.test/a.mp3", provenance: { playbackAuthorized: true, expiresAt: "2020-01-01T00:00:00Z" } });
    expect(await resolveMusicPlayback(repository, "alice", trackId)).toBeNull();
  });

  it("rejects malformed/bulk import payloads before any records are written", async () => {
    const repository = new InMemoryMusicRepository();
    await expect(importYouTubeCatalog(repository, "alice", { sourceId: "bad source", tracks: metadata.tracks })).rejects.toThrow();
    await expect(importYouTubeCatalog(repository, "alice", { sourceId: "good", tracks: Array(251).fill(metadata.tracks[0]) })).rejects.toThrow();
    await expect(importYouTubeCatalog(repository, "alice", { sourceId: "good", tracks: [{ videoId: "bad", title: "", artists: [] }] })).rejects.toThrow();
    expect(await repository.listTracks("alice")).toEqual([]);
  });
});

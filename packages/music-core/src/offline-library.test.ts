import { describe, expect, it } from "vitest";
import { InMemoryMusicRepository } from "./repository.js";
import { OfflineLibrary, type OfflineSourceResolver } from "./offline-library.js";

describe("OfflineLibrary", () => {
  it("registers a resolved local asset as offline media", async () => {
    const repository = new InMemoryMusicRepository();
    const resolver: OfflineSourceResolver = {
      async download(request) {
        return { asset: { id: "asset-1", trackId: request.track.id, sourceId: request.sourceId, kind: "file", uri: "file:///music/example.flac", mimeType: "audio/flac", codec: "flac", lossless: true } };
      },
    };
    const library = new OfflineLibrary(repository, resolver);
    const track = { id: "track-1", title: "Example", artistIds: ["artist-1"] };
    await library.makeAvailableOffline({ userId: "user-1", track, sourceId: "authorized-local", sourceUri: "owned://example" });
    const assets = await library.listOffline("user-1", "track-1");
    expect(assets).toHaveLength(1);
    expect(assets[0].kind).toBe("file");
    expect(assets[0].provenance?.offline).toBe(true);
  });
});

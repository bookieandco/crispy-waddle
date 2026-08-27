import { describe, expect, it } from "vitest";
import type { MediaAsset, Track } from "./types.js";
import { OfflineLibrary } from "./offline-library.js";
import { OfflineDownloadManager, type OfflineDownloadState, type OfflineDownloadStateStore } from "./offline-downloads.js";

const track: Track = { id: "t1", title: "Test", artistIds: ["a1"] };
const asset = { id: "asset-t1", trackId: "t1", sourceId: "owned", kind: "file", uri: "file:///music/t1.mp3", provenance: { offline: true } } as MediaAsset;

class Store implements OfflineDownloadStateStore {
  states: OfflineDownloadState[] = [];
  async get(userId: string, trackId: string) { return this.states.find((s) => s.userId === userId && s.trackId === trackId) ?? null; }
  async set(state: OfflineDownloadState) { this.states.push(state); }
}

function make(resolver: (request: any) => Promise<{ asset: MediaAsset }>) {
  const repository = { addAsset: async (_u: string, a: MediaAsset) => a, listAssets: async () => [] } as any;
  const library = new OfflineLibrary(repository, { download: resolver });
  const store = new Store();
  return { manager: new OfflineDownloadManager(library, store), store };
}

describe("offline download manager", () => {
  it("records queued, downloading, and available", async () => {
    const { manager, store } = make(async () => ({ asset }));
    await manager.download("u1", { track, sourceId: "owned", sourceUri: "file:///music/t1.mp3" });
    expect(store.states.map((s) => s.status)).toEqual(["queued", "downloading", "available"]);
    expect((await manager.getState("u1", track))?.status).toBe("available");
  });

  it("records failure and does not report availability", async () => {
    const { manager, store } = make(async () => { throw new Error("download failed"); });
    await expect(manager.download("u1", { track, sourceId: "owned", sourceUri: "file:///music/t1.mp3" })).rejects.toThrow("download failed");
    expect(store.states.map((s) => s.status)).toEqual(["queued", "downloading", "failed"]);
    expect((await manager.getState("u1", track))?.status).toBe("failed");
  });

  it("keeps download state user-scoped", async () => {
    const { manager } = make(async () => ({ asset }));
    await manager.download("u1", { track, sourceId: "owned", sourceUri: "file:///music/t1.mp3" });
    expect(await manager.getState("u2", track)).toBeNull();
  });
});

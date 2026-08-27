import { describe, expect, it } from "vitest";
import type { CatalogItem } from "./catalog-search.js";
import { createMusicControllerState } from "./music-controller.js";
import { hydrateCatalogItemToQueue } from "./catalog-hydration-queue.js";
import type { Track } from "./types.js";

const tracks: Track[] = [
  { id: "t1", title: "One", artistIds: ["a1"] },
  { id: "t2", title: "Two", artistIds: ["a2"] },
];

const playlist: CatalogItem = {
  kind: "playlist",
  playlist: { id: "p1", name: "Test", ownerId: "u1", sourceId: "youtube_music" },
};

describe("catalog hydration queue", () => {
  it("hydrates a collection and replaces the queue when requested", async () => {
    const state = await hydrateCatalogItemToQueue(createMusicControllerState(), playlist, "youtube_music", [
      { sourceId: "youtube_music", hydrate: async () => tracks },
    ], true);
    expect(state.queue.map((track) => track.id)).toEqual(["t1", "t2"]);
    expect(state.queueIndex).toBe(0);
  });

  it("appends hydrated tracks without disturbing the current queue index", async () => {
    const initial = { ...createMusicControllerState(), queue: [tracks[0]], queueIndex: 0 };
    const state = await hydrateCatalogItemToQueue(initial, playlist, "youtube_music", [
      { sourceId: "youtube_music", hydrate: async () => [tracks[1]] },
    ]);
    expect(state.queue.map((track) => track.id)).toEqual(["t1", "t2"]);
    expect(state.queueIndex).toBe(0);
  });

  it("rejects a provider/source mismatch", async () => {
    await expect(hydrateCatalogItemToQueue(createMusicControllerState(), playlist, "spotify", [
      { sourceId: "youtube_music", hydrate: async () => tracks },
    ])).rejects.toThrow("No catalog hydrator for source: spotify");
  });

  it("preserves an empty hydration result without creating a phantom queue entry", async () => {
    const initial = { ...createMusicControllerState(), queue: [tracks[0]], queueIndex: 0 };
    const state = await hydrateCatalogItemToQueue(initial, playlist, "youtube_music", [
      { sourceId: "youtube_music", hydrate: async () => [] },
    ]);
    expect(state.queue.map((track) => track.id)).toEqual(["t1"]);
  });
});

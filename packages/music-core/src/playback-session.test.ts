import { describe, expect, it } from "vitest";
import { PlaybackSession } from "./playback-session.js";
import { createMusicControllerState } from "./music-controller.js";
import { MemoryPlaybackHost } from "./playback-host.js";
import type { Track } from "./types.js";

const track: Track = { id: "t1", title: "Test", artistIds: ["a1"] };
const asset = { id: "asset-1", trackId: "t1", sourceId: "s1", kind: "stream", uri: "https://example.test/audio" } as any;

describe("PlaybackSession", () => {
  it("requires explicit user identity", () => {
    expect(() => new PlaybackSession("", { resolve: async () => null }, new MemoryPlaybackHost(), createMusicControllerState())).toThrow("userId");
  });
  it("passes the explicit user id to the resolver", async () => {
    let seen: string | undefined;
    const session = new PlaybackSession("u1", { resolve: async (request) => { seen = request.userId; return { track, asset, mode: "network" }; } }, new MemoryPlaybackHost(), createMusicControllerState());
    await session.load(track);
    expect(seen).toBe("u1");
    expect(session.getUserId()).toBe("u1");
    expect(session.getState().resolvedAssetId).toBe("asset-1");
  });
  it("fails cleanly when no playable source resolves", async () => {
    const session = new PlaybackSession("u1", { resolve: async () => null }, new MemoryPlaybackHost(), createMusicControllerState());
    await expect(session.load(track)).rejects.toThrow("No authorized playable source");
    expect(session.getState().playing).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { JhadinaMusicPlaybackAdapter } from "./jhadina-music-playback-adapter.js";
import { createMusicControllerState } from "./music-controller.js";
import { MemoryPlaybackHost } from "./playback-host.js";
import type { Track } from "./types.js";

const first: Track = { id: "t1", title: "First", artistIds: ["a1"] };
const second: Track = { id: "t2", title: "Second", artistIds: ["a2"] };
const asset = (track: Track) => ({ id: `asset-${track.id}`, trackId: track.id, sourceId: "s1", kind: "stream", uri: `https://example.test/${track.id}` }) as any;

function makeAdapter() {
  const host = new MemoryPlaybackHost();
  const seen: string[] = [];
  const adapter = new JhadinaMusicPlaybackAdapter("u1", { resolve: async ({ track, userId }) => { seen.push(`${userId}:${track.id}`); return { track, asset: asset(track), mode: "network" }; } }, host, { ...createMusicControllerState(), queue: [first, second], queueIndex: 0 });
  return { adapter, host, seen };
}

describe("JhadinaMusicPlaybackAdapter integration", () => {
  it("uses one session state for play and host loading", async () => {
    const { adapter, host, seen } = makeAdapter();
    await adapter.play();
    expect(adapter.getState().playing).toBe(true);
    expect(adapter.session.getState()).toEqual(expect.objectContaining({ playing: true, resolvedAssetId: "asset-t1" }));
    expect(host.getState().asset?.trackId).toBe("t1");
    expect(seen).toEqual(["u1:t1"]);
  });
  it("resolves the next track through the same session", async () => {
    const { adapter, host, seen } = makeAdapter();
    await adapter.play();
    await adapter.next();
    expect(adapter.getState().queueIndex).toBe(1);
    expect(adapter.session.getState().queueIndex).toBe(1);
    expect(host.getState().asset?.trackId).toBe("t2");
    expect(seen).toEqual(["u1:t1", "u1:t2"]);
  });
  it("pauses the host and shared session state", async () => {
    const { adapter, host } = makeAdapter();
    await adapter.play();
    await adapter.pause();
    expect(adapter.getState().playing).toBe(false);
    expect(adapter.session.getState().playing).toBe(false);
    expect(host.getState().playing).toBe(false);
  });
  it("propagates resolver failure without leaving playback marked active", async () => {
    const host = new MemoryPlaybackHost();
    const adapter = new JhadinaMusicPlaybackAdapter("u1", { resolve: async () => null }, host, { ...createMusicControllerState(), queue: [first], queueIndex: 0 });
    await expect(adapter.play()).rejects.toThrow("No authorized playable source");
    expect(adapter.getState().playing).toBe(false);
    expect(host.getState().playing).toBe(false);
  });
});

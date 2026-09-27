import { describe, expect, it } from "vitest";
import type { Track } from "./types.js";
import { addToQueue, createPlaybackState, cycleRepeat, removeFromQueue, reorderQueue, restorePlayerState, serializePlayerState } from "./player-controller.js";

const track = (id: string): Track => ({ id, title: id, artistIds: [] });

describe("persistent music player controller", () => {
  it("restores queue position paused instead of auto-playing after navigation", () => {
    const restored = restorePlayerState({ queue: [track("a"), track("b")], queueIndex: 1, track: track("b"), positionMs: 42000, repeat: "queue", shuffle: true });
    expect(restored).toMatchObject({ queueIndex: 1, positionMs: 42000, repeat: "queue", shuffle: true, playing: false });
  });

  it("inserts play-next without losing current queue identity", () => {
    const state = { ...createPlaybackState(), queue: [track("a"), track("c")], queueIndex: 0, track: track("a"), playing: true };
    expect(addToQueue(state, track("b"), "next").queue.map((item) => item.id)).toEqual(["a", "b", "c"]);
  });

  it("reorders and removes while keeping the active track selected", () => {
    const state = { ...createPlaybackState(), queue: [track("a"), track("b"), track("c")], queueIndex: 1, track: track("b") };
    const reordered = reorderQueue(state, 2, 0);
    expect(reordered.queue.map((item) => item.id)).toEqual(["c", "a", "b"]);
    expect(reordered.queueIndex).toBe(2);
    expect(removeFromQueue(reordered, "a").track?.id).toBe("b");
  });

  it("cycles repeat and serializes only durable player state", () => {
    const state = cycleRepeat(createPlaybackState());
    expect(state.repeat).toBe("queue");
    expect(serializePlayerState(state)).not.toHaveProperty("playing");
  });
});

import { describe, expect, it } from "vitest";
import type { Track } from "./types.js";
import { addToQueue, createPlaybackState, cycleRepeat, nextTrack, previousTrack, removeFromQueue, reorderQueue, restorePlayerState, serializePlayerState, setQueue, toggleShuffle } from "./player-controller.js";

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
  it("plays every song in a shuffle pass exactly once, with true Previous history", () => {
    const source = setQueue(createPlaybackState(), [track("a"), track("b"), track("c"), track("d")], 0);
    let state = toggleShuffle(source);
    expect(state.shuffleRemaining).toHaveLength(3);
    const seen = ["a"];
    state = nextTrack(state);
    const first = state.track!.id;
    seen.push(first);
    const rewound = previousTrack(state);
    expect(rewound.track?.id).toBe("a");
    state = nextTrack(rewound);
    expect(state.track?.id).toBe(first);
    for (let i = 0; i < 2; i++) {
      state = nextTrack(state);
      seen.push(state.track!.id);
    }
    expect(new Set(seen).size).toBe(4);
    const atEnd = nextTrack(state);
    expect(atEnd.playing).toBe(false);
    expect(atEnd.track?.id).toBe(state.track?.id);
  });

  it("preserves shuffle pass across reload and excludes immediately repeated tracks on queue repeat", () => {
    let state = toggleShuffle(setQueue(createPlaybackState(), [track("a"), track("b"), track("c")]));
    state = nextTrack(state);
    const persisted = restorePlayerState(serializePlayerState(state));
    expect(persisted.playing).toBe(false);
    expect(persisted.shuffleHistory).toEqual(state.shuffleHistory);
    expect(persisted.shuffleRemaining).toEqual(state.shuffleRemaining);
    state = { ...persisted, repeat: "queue" };
    state = nextTrack(state);
    const lastId = state.track!.id;
    state = nextTrack(state);
    expect(state.track?.id).not.toBe(lastId);
  });

  it("keeps shuffle bag in sync with explicit play-next and queue removal", () => {
    let state = toggleShuffle(setQueue(createPlaybackState(), [track("a"), track("b"), track("c")]));
    state = addToQueue(state, track("d"), "next");
    expect(nextTrack(state).track?.id).toBe("d");
    state = removeFromQueue(state, "b");
    expect(state.shuffleRemaining).not.toContain("b");
  });
});

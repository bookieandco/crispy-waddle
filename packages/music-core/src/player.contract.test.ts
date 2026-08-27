import { describe, expect, it } from "vitest";
import { createPlaybackState, playTrack, setQueue, nextTrack, previousTrack } from "./player.js";
import type { Track } from "./types.js";

const a = { id: "a", title: "A", artistIds: ["artist-a"], albumId: undefined, durationMs: 180000 } as Track;
const b = { id: "b", title: "B", artistIds: ["artist-b"], albumId: undefined, durationMs: 180000 } as Track;

 describe("playback controller contract", () => {
  it("uses one queue and current index", () => {
    const state = setQueue(createPlaybackState(), [a, b], 0);
    expect(state.queue.map((track) => track.id)).toEqual(["a", "b"]);
    expect(state.queueIndex).toBe(0);
    expect(state.playing).toBe(true);
  });

  it("plays an existing track without duplicating it", () => {
    const state = setQueue(createPlaybackState(), [a, b], 0);
    const next = playTrack(state, b);
    expect(next.queue).toHaveLength(2);
    expect(next.queueIndex).toBe(1);
    expect(next.positionMs).toBe(0);
  });

  it("advances and stops at the end when repeat is off", () => {
    const state = setQueue(createPlaybackState(), [a, b], 0);
    const advanced = nextTrack(state);
    expect(advanced.queueIndex).toBe(1);
    const stopped = nextTrack(advanced);
    expect(stopped.playing).toBe(false);
  });

  it("repeats the queue", () => {
    const state = { ...setQueue(createPlaybackState(), [a, b], 1), repeat: "all" as const };
    const wrapped = nextTrack(state);
    expect(wrapped.queueIndex).toBe(0);
    expect(wrapped.playing).toBe(true);
  });

  it("previous resets the current track when sufficiently played", () => {
    const state = { ...setQueue(createPlaybackState(), [a, b], 1), positionMs: 9000 };
    const previous = previousTrack(state);
    expect(previous.queueIndex).toBe(1);
    expect(previous.positionMs).toBe(0);
  });
});

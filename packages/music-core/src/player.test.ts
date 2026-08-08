import { describe, expect, it } from "vitest";
import { createPlaybackState, nextTrack, previousTrack, setQueue } from "./player.js";
import type { Track } from "./types.js";

const track = (id: string): Track => ({ id, title: id, artistIds: [] });

describe("music player", () => {
  it("starts the queue at the requested track", () => {
    const state = setQueue(createPlaybackState(), [track("a"), track("b")], 1);
    expect(state.track?.id).toBe("b");
    expect(state.playing).toBe(true);
  });

  it("advances and goes back deterministically", () => {
    const state = setQueue(createPlaybackState(), [track("a"), track("b"), track("c")]);
    expect(nextTrack(state).track?.id).toBe("b");
    expect(previousTrack(nextTrack(state)).track?.id).toBe("a");
  });
});

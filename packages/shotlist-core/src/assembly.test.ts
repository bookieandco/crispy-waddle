import { describe, expect, it } from "vitest";
import { buildTimeline } from "./assembly.js";
import type { ClipRef } from "./assembly.js";
import type { Shot } from "./types.js";

const shot = (id: string, sceneScriptOrder: number, ordinal: number, durationSec = 4): Shot => ({
  id,
  projectId: "proj-1",
  sceneScriptOrder,
  ordinal,
  shotType: "medium",
  durationSec,
  action: `action for ${id}`,
  entityHandles: [],
  status: "approved",
});

const clip = (shotId: string, durationSec: number, provider = "wan2.2"): ClipRef => ({
  shotId,
  uri: `s3://clips/${shotId}.mp4`,
  provider,
  durationSec,
});

describe("buildTimeline", () => {
  it("orders edits by sceneScriptOrder then ordinal, regardless of input order", () => {
    const shots = [shot("c", 1, 2), shot("a", 1, 1), shot("b", 2, 1)];
    const clips = [clip("a", 5), clip("b", 4), clip("c", 3)];
    const timeline = buildTimeline("proj-1", shots, clips);
    expect(timeline.edits.map((e) => e.shotId)).toEqual(["a", "c", "b"]);
  });

  it("stitches short clips into a longer cumulative timeline", () => {
    const shots = [shot("a", 1, 1), shot("b", 2, 1), shot("c", 3, 1)];
    const clips = [clip("a", 5), clip("b", 5), clip("c", 5)];
    const timeline = buildTimeline("proj-1", shots, clips);
    expect(timeline.totalDurationSec).toBe(15);
    expect(timeline.edits.map((e) => e.startSec)).toEqual([0, 5, 10]);
  });

  it("reports shots with no matching clip instead of throwing", () => {
    const shots = [shot("a", 1, 1), shot("b", 2, 1)];
    const clips = [clip("a", 5)];
    const timeline = buildTimeline("proj-1", shots, clips);
    expect(timeline.missingClips).toEqual(["b"]);
    expect(timeline.edits.map((e) => e.shotId)).toEqual(["a"]);
    expect(timeline.totalDurationSec).toBe(5);
  });

  it("defaults to a cut transition, honors per-shot overrides", () => {
    const shots = [shot("a", 1, 1), shot("b", 2, 1)];
    const clips = [clip("a", 5), clip("b", 5)];
    const timeline = buildTimeline("proj-1", shots, clips, {
      defaultTransition: "cut",
      transitions: { b: "crossfade" },
    });
    expect(timeline.edits[0].transitionIn).toBe("cut");
    expect(timeline.edits[1].transitionIn).toBe("crossfade");
  });

  it("passes localization tracks through unchanged", () => {
    const shots = [shot("a", 1, 1)];
    const clips = [clip("a", 5)];
    const localization = [{ language: "es", subtitleUri: "s3://subs/es.srt", dubAudioUri: "s3://dub/es.wav" }];
    const timeline = buildTimeline("proj-1", shots, clips, { localization });
    expect(timeline.localization).toEqual(localization);
  });

  it("handles an empty shot list without throwing", () => {
    const timeline = buildTimeline("proj-1", [], []);
    expect(timeline.edits).toEqual([]);
    expect(timeline.totalDurationSec).toBe(0);
    expect(timeline.missingClips).toEqual([]);
  });
});

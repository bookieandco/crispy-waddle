import { describe, expect, it } from "vitest";
import { buildTimeline } from "./assembly.js";
import type { ClipRef } from "./assembly.js";
import type { Shot } from "./types.js";

const shot = (id: string, sceneScriptOrder: number, ordinal: number, durationSec = 4): Shot => ({ id, projectId: "proj-1", sceneScriptOrder, ordinal, shotType: "medium", durationSec, action: `action for ${id}`, entityHandles: [], status: "approved" });
const clip = (shotId: string, durationSec: number, provider = "wan2.2"): ClipRef => ({ shotId, uri: `s3://clips/${shotId}.mp4`, provider, durationSec });

describe("buildTimeline", () => {
  it("orders by sceneScriptOrder then ordinal", () => { const t = buildTimeline("proj-1", [shot("c",1,2),shot("a",1,1),shot("b",2,1)], [clip("a",5),clip("b",4),clip("c",3)]); expect(t.edits.map(e=>e.shotId)).toEqual(["a","c","b"]); });
  it("stitches clips cumulatively", () => { const t = buildTimeline("proj-1", [shot("a",1,1),shot("b",2,1),shot("c",3,1)], [clip("a",5),clip("b",5),clip("c",5)]); expect(t.totalDurationSec).toBe(15); expect(t.edits.map(e=>e.startSec)).toEqual([0,5,10]); });
  it("reports missing clips", () => { const t = buildTimeline("proj-1", [shot("a",1,1),shot("b",2,1)], [clip("a",5)]); expect(t.missingClips).toEqual(["b"]); expect(t.totalDurationSec).toBe(5); });
  it("honors transition overrides", () => { const t = buildTimeline("proj-1", [shot("a",1,1),shot("b",2,1)], [clip("a",5),clip("b",5)], { transitions:{b:"crossfade"} }); expect(t.edits[0].transitionIn).toBe("cut"); expect(t.edits[1].transitionIn).toBe("crossfade"); });
  it("passes localization through", () => { const l=[{language:"es",subtitleUri:"s3://subs/es.srt",dubAudioUri:"s3://dub/es.wav"}]; expect(buildTimeline("proj-1",[shot("a",1,1)],[clip("a",5)],{localization:l}).localization).toEqual(l); });
  it("handles empty input", () => { expect(buildTimeline("proj-1",[],[])).toMatchObject({edits:[],totalDurationSec:0,missingClips:[]}); });
});

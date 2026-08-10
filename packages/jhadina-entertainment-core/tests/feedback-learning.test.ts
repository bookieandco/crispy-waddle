import { strict as assert } from "node:assert";
import { InMemoryEntertainmentCore } from "../src/engine";

const core = new InMemoryEntertainmentCore();

core.addObservation({
  id: "obs_early_hook_1",
  mediaId: "song_1",
  domain: "music",
  technique: "early_hook",
  interpretation: "The primary hook arrives quickly.",
  evidence: [{ sourceId: "song_1", kind: "measurement", note: "first hook at 00:31" }],
  confidence: 0.94,
});

core.addObservation({
  id: "obs_long_intro_1",
  mediaId: "song_2",
  domain: "music",
  technique: "long_intro",
  interpretation: "The main vocal entry is delayed.",
  evidence: [{ sourceId: "song_2", kind: "measurement", note: "vocal entry at 01:12" }],
  confidence: 0.9,
});

core.recordFeedback({ targetId: "obs_early_hook_1", signal: "positive", scope: "technique", createdAt: "2026-08-10T00:00:00Z" });
core.recordFeedback({ targetId: "obs_early_hook_1", signal: "positive", scope: "technique", createdAt: "2026-08-10T00:01:00Z" });
core.recordFeedback({ targetId: "obs_long_intro_1", signal: "negative", scope: "technique", createdAt: "2026-08-10T00:02:00Z" });

const hypotheses = core.detectHypotheses();
const earlyHook = hypotheses.find((item) => item.pattern === "early_hook");
assert.ok(earlyHook);
assert.equal(earlyHook.positiveCount, 2);
assert.equal(earlyHook.negativeCount, 0);

const preference = core.approve(earlyHook, "2026-08-10T00:03:00Z");
assert.equal(preference.preference, "early_hook");
assert.equal(core.getApprovedPreferences("music").length, 1);

const context = core.getContext("music", "develop an energetic single");
assert.equal(context.approvedPreferences[0]?.preference, "early_hook");

console.log("JEI feedback-learning vertical slice: PASS");

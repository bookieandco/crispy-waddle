import { test } from "node:test";
import assert from "node:assert/strict";
import { perceptionJobId, retryDelayMs } from "./perception-job.js";

test("perception job identity is actor and asset scoped", () => {
  assert.equal(perceptionJobId("u1", "a1"), "perception:u1:a1");
  assert.notEqual(perceptionJobId("u1", "a1"), perceptionJobId("u2", "a1"));
});

test("retry backoff is bounded and deterministic", () => {
  assert.equal(retryDelayMs(1), 5000);
  assert.equal(retryDelayMs(2), 10000);
  assert.equal(retryDelayMs(20), 900000);
});

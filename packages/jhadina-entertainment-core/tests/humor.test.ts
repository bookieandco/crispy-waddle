import { describe, expect, it } from "vitest";
import { HumorCore } from "../src/humor";

describe("HumorCore", () => {
  it("suppresses humor for serious or high-risk contexts", () => {
    const humor = new HumorCore();
    const result = humor.evaluate({
      context: "security incident",
      audience: "private",
      seriousness: 0.95,
      emotionalLoad: 0.8,
      risk: "high",
      callbackCandidates: [],
    });
    expect(result.shouldHumor).toBe(false);
  });

  it("favors callbacks when shared history is available", () => {
    const humor = new HumorCore();
    const modes = humor.rankModes({
      context: "another deployment problem",
      audience: "private",
      seriousness: 0.2,
      emotionalLoad: 0.1,
      risk: "low",
      callbackCandidates: ["deployment-gremlin"],
    });
    expect(modes[0]).toBe("callback");
  });

  it("uses relationship consent to calibrate teasing", () => {
    const humor = new HumorCore({ teasing: 1 });
    humor.setRelationship("user", {
      audience: "close",
      familiarity: 0.9,
      teasingConsent: 0,
      preferredModes: ["deadpan"],
      avoidTopics: [],
    });
    expect(humor.rankModes({
      context: "casual conversation",
      audience: "close",
      seriousness: 0.1,
      emotionalLoad: 0.1,
      risk: "low",
      callbackCandidates: [],
    }, "user")[0]).toBe("deadpan");
  });

  it("learns from explicit feedback without rewriting the profile", () => {
    const humor = new HumorCore();
    expect(humor.feedbackScore("joke-1")).toBe(0.5);
    humor.recordFeedback({ candidateId: "joke-1", signal: "positive", explicit: true, at: new Date().toISOString() });
    expect(humor.feedbackScore("joke-1")).toBeGreaterThan(0.5);
  });
});

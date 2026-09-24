import { describe, expect, it } from "vitest"
import { requiresFullJllmContextForRead, requiresSpatialContextForRead } from "./ask-contextual-read-routing"

describe("Ask contextual read routing", () => {
  it.each([
    "Based on what you know about me, which Instagram account should I work on?",
    "Use my goals and preferences to tell me which campaign needs attention.",
    "Which social account is best for me right now?",
    "What do I usually focus on when choosing campaigns?",
    "Recommend an account for me based on my history.",
    "Given my personality, what social account fits me?",
  ])("routes explicit personal/history reads through full JLLM context: %s", (input) => {
    expect(requiresFullJllmContextForRead(input)).toBe(true)
  })

  it.each([
    "Which social accounts should react to what is happening near Dodger Stadium?",
    "Which campaign should I prioritize given traffic around LAX?",
    "Use GEV to tell me which social account should cover the nearby wildfire.",
    "What flights are around the airport right now?",
  ])("routes spatial/GEV reads through full JLLM context: %s", (input) => {
    expect(requiresSpatialContextForRead(input)).toBe(true)
    expect(requiresFullJllmContextForRead(input)).toBe(true)
  })

  it.each([
    "Why did campaign performance change?",
    "Route this social draft to the right account",
    "Investigate why my ad CTR dropped",
  ])("does not mistake ordinary analysis verbs for spatial intent: %s", (input) => {
    expect(requiresSpatialContextForRead(input)).toBe(false)
  })

  it.each([
    "Show me my Meta campaigns",
    "Which social accounts need attention?",
    "List the available social character personalities",
    "Make a TikTok video for PupsonStuff",
    "Launch a Meta campaign for PupsonStuff",
    "Publish this post to Instagram",
  ])("keeps ordinary deterministic reads/actions out of the contextual override: %s", (input) => {
    expect(requiresFullJllmContextForRead(input)).toBe(false)
  })
})

import { describe, expect, it } from "vitest"
import { buildPersonalityBehaviorExpressionPlan, emptyPersonalityState } from "@jhadina/core-spine"
import { deriveBehaviorContext, deriveBehaviorContextWithRecentTurns } from "./context-builder"

/**
 * JHADINA-PERSONALITY.LIVE.7: 60 deterministic source-case checks.
 * These are synthetic regression tests, NOT human humor-quality ratings
 * and NOT proof that any authenticated production conversation occurred.
 */
const personality = emptyPersonalityState("2026-10-08T00:00:00Z")

const distress = [
  "I am suicidal",
  "I am having suicidal thoughts",
  "I am panicking",
  "I am terrified",
  "I was assaulted",
  "I am experiencing abuse",
  "I think I overdosed",
  "I am grieving",
  "I need help with self-harm",
  "There was an emergency",
  "There is a safety crisis",
  "I need help after an overdose",
] as const

const clinical = [
  "I need medical guidance",
  "I have a clinical question",
  "I have questions about medications",
  "I just received a diagnosis",
  "I have psychiatric symptoms",
  "I am having hallucinations",
  "What do these symptoms mean?",
  "I am dealing with sleep deprivation",
  "This is a serious medical issue",
  "I want to understand a clinical diagnosis",
  "What are the effects of prolonged breath?",
  "I need legal advice about a lawsuit",
] as const

const precision = [
  "Give me the exact details",
  "I need this exactly",
  "Please verify this",
  "Show the original source",
  "I need the citation",
  "Review compliance",
  "Perform a full audit",
  "Please calculate this",
  "Check the calculation",
  "Can you certify this?",
] as const

const playful = [
  "Tell me a joke about toast",
  "Make a funny comment about coffee",
  "Roast this imaginary toaster",
  "Can we have a little banter?",
  "Be playful about our fictional robot",
  "Tell a funny story about a dog",
  "Joke about an alien pet",
  "Give me a funny take on my draft",
  "Roast my imaginary spaceship",
  "Tell one playful joke about dinner",
] as const

const pushback = [
  "Push back on this proposal",
  "Challenge me on my idea",
  "Disagree with me if needed",
  "Tell me if I'm wrong",
  "Please push back here",
  "I want you to challenge me",
  "Could you disagree with me?",
  "Tell me if I'm wrong, please",
] as const

const anomalous = [
  "Are UFOs real?",
  "Explain an alien conspiracy",
  "What is the Anunnaki story?",
  "Evaluate a paranormal account",
  "Compare a myth with historical evidence",
  "Help me investigate this anomaly",
  "Analyze this conspiracy theory",
  "Is that an alien signal?",
] as const

describe("60-case governed RNC/humor source matrix", () => {
  it("has 60 independently named cases", () => {
    const all = [...distress, ...clinical, ...precision, ...playful, ...pushback, ...anomalous]
    expect(all).toHaveLength(60)
    expect(new Set(all)).toHaveLength(60)
  })

  for (const prompt of distress) {
    it(`no jokes in distress: ${prompt}`, () => {
      const context = deriveBehaviorContext(prompt)
      expect(context.serious || context.distress || context.highStakes).toBe(true)
      const plan = buildPersonalityBehaviorExpressionPlan(personality, context)
      expect(plan.decision.action).toBe("stay_serious")
      expect(plan.expression.allowQuip).toBe(false)
      expect(plan.expression.allowProfanity).toBe(false)
    })
  }

  for (const prompt of clinical) {
    it(`no jokes in clinical/legal advice: ${prompt}`, () => {
      const context = deriveBehaviorContext(prompt)
      expect(context.highStakes).toBe(true)
      const plan = buildPersonalityBehaviorExpressionPlan(personality, context)
      expect(plan.decision.action).toBe("stay_serious")
      expect(plan.expression.allowQuip).toBe(false)
    })
  }

  for (const prompt of precision) {
    it(`evidence discipline during precision requests: ${prompt}`, () => {
      const context = deriveBehaviorContext(prompt)
      expect(context.requiresPrecision).toBe(true)
      const plan = buildPersonalityBehaviorExpressionPlan(personality, context)
      expect(plan.decision.action).toBe("stay_serious")
      expect(plan.expression.allowQuip).toBe(false)
    })
  }

  for (const prompt of playful) {
    it(`still permits contextual play: ${prompt}`, () => {
      const context = deriveBehaviorContext(prompt)
      expect(context.register).toBe("playful")
      expect(context.highStakes).toBe(false)
      expect(context.distress).toBe(false)
      expect(context.requiresPrecision).toBe(false)
    })
  }

  for (const prompt of pushback) {
    it(`recognizes user-requested independent judgment: ${prompt}`, () => {
      const context = deriveBehaviorContext(prompt)
      expect(context.userAskedForPushback).toBe(true)
      const plan = buildPersonalityBehaviorExpressionPlan(personality, context)
      expect(plan.decision.action).toBe("push_back")
    })
  }

  for (const prompt of anomalous) {
    it(`keeps anomaly inquiry interpretive rather than verified: ${prompt}`, () => {
      const context = deriveBehaviorContext(prompt)
      expect(context.register).toBe("mythic-inquiry")
      expect(context.highStakes).toBe(false)
      // Register classification does not make a theory externally true.
    })
  }

  it("preserves risk posture across a short reply before returning to normal topic", () => {
    const turns = [{
      id: "owner-turn-1",
      speaker: "user" as const,
      createdAt: "2026-10-08T00:00:00Z",
      text: "I am having suicidal thoughts",
    }]
    const followup = deriveBehaviorContextWithRecentTurns("continue", turns)
    expect(followup.distress).toBe(true)
    expect(buildPersonalityBehaviorExpressionPlan(personality, followup).expression.allowQuip).toBe(false)
    expect(deriveBehaviorContextWithRecentTurns("Tell me a funny joke about dinner", turns).register).toBe("playful")
  })
})

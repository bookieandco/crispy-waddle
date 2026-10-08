import { describe, expect, it } from "vitest"
import {
  buildPersonalityBehaviorExpressionPlan,
  createSessionExpressionState,
  emptyPersonalityState,
} from "@jhadina/core-spine"
import { deriveBehaviorContext } from "./context-builder"

/**
 * End-to-end expression firewall regression: previously an exact word-boundary
 * after a truncated stem missed "suicidal", "hallucinations", "diagnosis",
 * "medications" and "psychiatric". When missed, a playful register could
 * leave the Quip Engine eligible in a high-stakes conversation.
 */
describe("Jhadina humor safety across clinical and distress inflections", () => {
  const examples = [
    ["I have suicidal thoughts and need support.", "distress"],
    ["My friend is feeling suicidal.", "distress"],
    ["I am experiencing hallucinations.", "perceptual"],
    ["What do my medications do?", "clinical"],
    ["I just received a diagnosis.", "clinical"],
    ["I need help with psychiatric symptoms.", "clinical"],
    ["What do these symptoms mean?", "clinical"],
    ["I am panicking after an overdose.", "distress"],
  ] as const

  for (const [request, kind] of examples) {
    it(`suppresses joke, profanity and banter for: ${request}`, () => {
      const context = deriveBehaviorContext(request)
      expect(context.highStakes || context.distress).toBe(true)
      expect(context.banterEligible).toBe(false)

      if (kind === "clinical") expect(context.register).toBe("clinical")
      if (kind === "perceptual") expect(context.register).toBe("perceptual-inquiry")
      if (kind === "distress") expect(context.distress).toBe(true)

      const plan = buildPersonalityBehaviorExpressionPlan(
        emptyPersonalityState("2026-10-08T00:00:00.000Z"),
        {
          ...context,
          session: createSessionExpressionState(),
          quipCandidates: [{
            id: "unsafe-humor",
            text: "An inappropriate joke",
            naturalness: 1,
            timing: 1,
            contextFit: 1,
            relationshipFit: 1,
            personalityFit: 1,
            truthCompatibility: 1,
          }],
          banterInput: {
            turn: 1,
            bitId: "inappropriate-bit",
            phrase: "not for this context",
            origin: "jhadina",
            strategyCap: 3,
          },
        },
      )

      expect(plan.decision.action).toBe("stay_serious")
      expect(plan.quip).toBeUndefined()
      expect(plan.banterTransition?.runtime.stage).toBe("exit")
      expect(plan.expression).toMatchObject({
        register: "serious",
        allowQuip: false,
        allowProfanity: false,
        bitDepth: 0,
        operationalSass: "off",
        evidenceDiscipline: "strict",
      })
      expect(plan.expression.quip).toBeUndefined()
    })
  }

  it("does not globally disable ordinary playful conversation", () => {
    const context = deriveBehaviorContext("Tell me a funny joke about a toaster")
    expect(context.register).toBe("playful")
    expect(context.highStakes).toBe(false)
    expect(context.distress).toBe(false)
    expect(context.banterEligible).toBe(true)
  })
})

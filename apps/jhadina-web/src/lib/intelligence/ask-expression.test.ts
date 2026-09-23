import { describe, expect, it } from "vitest"
import { emptyPersonalityState, type DecisionProposal } from "@jhadina/core-spine"
import { realizeAskJhadinaExpression } from "./ask-expression"

function proposal(disposition: DecisionProposal["disposition"]): DecisionProposal {
  return {
    id: `proposal-${disposition.toLowerCase()}`,
    contextId: "ctx-test",
    disposition,
    recommendation: "Use the verified operational result.",
    rationale: "The specialized route owns deterministic semantic truth.",
    evidence: [],
    uncertainty: [],
    alternatives: [],
  }
}

describe("Ask Jhadina governed expression bridge", () => {
  it("uses the governed Personality -> RNC -> Behavior -> Expression contribution", async () => {
    const result = await realizeAskJhadinaExpression(
      {
        userId: "user-expression",
        activeTask: "keep it direct",
        proposal: proposal("PROCEED"),
      },
      {
        personalityContextProvider: {
          getContext: async () => ({
            patterns: [],
            personality: emptyPersonalityState("2026-09-22T12:00:00.000Z"),
            expressionDirective: {
              mode: "direct",
              allowProfanity: true,
              allowQuip: true,
              callback: "Known callback.",
            },
            limitations: [],
          }),
        },
      },
    )

    expect(result.presentation.mode).toBe("direct")
    expect(result.presentation.allowProfanity).toBe(true)
    expect(result.presentation.allowQuip).toBe(true)
    expect(result.segments).toEqual([
      { kind: "semantic", text: "Use the verified operational result." },
      { kind: "callback", text: "Known callback." },
    ])
  })

  it("forces a clarifying presentation for ASK without discarding governed style flags", async () => {
    const result = await realizeAskJhadinaExpression(
      {
        userId: "user-expression",
        activeTask: "do the thing",
        proposal: proposal("ASK"),
      },
      {
        personalityContextProvider: {
          getContext: async () => ({
            patterns: [],
            personality: emptyPersonalityState("2026-09-22T12:00:00.000Z"),
            expressionDirective: {
              mode: "direct",
              allowProfanity: false,
              allowQuip: true,
            },
            limitations: [],
          }),
        },
      },
    )

    expect(result.presentation.mode).toBe("clarifying")
    expect(result.presentation.allowQuip).toBe(true)
  })

  it("fails closed to neutral presentation when personality context is unavailable", async () => {
    const result = await realizeAskJhadinaExpression(
      {
        userId: "user-expression",
        activeTask: "status",
        proposal: proposal("PROCEED"),
      },
      {
        personalityContextProvider: {
          getContext: async () => {
            throw new Error("personality store unavailable")
          },
        },
      },
    )

    expect(result.presentation).toEqual({
      mode: "direct",
      allowProfanity: false,
      allowQuip: false,
    })
  })
})

import {describe,expect,it} from "vitest"
import type {ContextPacket} from "@jhadina/core-spine"
import {LegacyClassifierProvider} from "./legacy-classifier-provider"

describe("non-generative classifier fallback",()=>{
 it("never presents the user's question as a completed general answer",async()=>{
  const request="Explain quantum mechanics to a ten year old"
  const result=await new LegacyClassifierProvider().propose({
   id:"test-context",purpose:request,userGoal:request,
  } as ContextPacket)
  expect(result.disposition).toBe("DEFER")
  expect(result.recommendation).not.toBe(request)
  expect(result.recommendation).toMatch(/reasoning model is unavailable/i)
  expect(result.evidence).toEqual([])
  expect(result.uncertainty.join(" ")).toMatch(/non-generative/i)
 })
})

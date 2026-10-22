import {describe,it,expect,vi} from "vitest"
import type {ContextPacket,DecisionProposal} from "@jhadina/core-spine"
import {localModelEntry} from "@jhadina/intelligence-core"
import {GovernedJllmModelRouter} from "./governed-model-routing"
const ctx=(goal:string,artifacts:unknown[]=[])=>({id:"ctx",purpose:goal,userGoal:goal,artifacts} as ContextPacket)
const proposal:DecisionProposal={id:"p",contextId:"ctx",disposition:"DEFER",recommendation:"no action",rationale:"bounded",evidence:[],uncertainty:[],alternatives:[]}
const model=localModelEntry({id:"local.test",providerModelId:"qwen",version:1,contextWindowTokens:8192,maxOutputTokens:512,enabled:true})
describe("canonical capability router for Ask Jhadina",()=>{
 it("routes grounded text to the explicitly registered local model",async()=>{
  const propose=vi.fn(async()=>proposal)
  const router=new GovernedJllmModelRouter([{model,provider:{name:"local",propose}}])
  expect(await router.propose(ctx("Explain these steps"))).toBe(proposal)
  expect(propose).toHaveBeenCalledTimes(1)
 })
 it("rejects unsupported research without inventing a web browsing tool",async()=>{
  const propose=vi.fn(async()=>proposal)
  const router=new GovernedJllmModelRouter([{model,provider:{name:"local",propose}}])
  await expect(router.propose(ctx("Research latest current news with verified sources"))).rejects.toThrow("NO_ELIGIBLE_MODEL")
  expect(propose).not.toHaveBeenCalled()
 })
 it("cannot route images into a text-only model",async()=>{
  const propose=vi.fn(async()=>proposal)
  const router=new GovernedJllmModelRouter([{model,provider:{name:"local",propose}}])
  await expect(router.propose(ctx("Explain this screenshot",[{kind:"image"}]))).rejects.toThrow("NO_ELIGIBLE_MODEL")
  expect(propose).not.toHaveBeenCalled()
 })
 it("fails closed without any explicitly commissioned model",async()=>{
  await expect(new GovernedJllmModelRouter([]).propose(ctx("Hello"))).rejects.toThrow("NO_ELIGIBLE_MODEL")
 })
})

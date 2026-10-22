import {describe,it,expect} from "vitest"
import {readJllmReasoningReadiness} from "./production-model-provider"
describe("explicit, zero-cost JLLM provider readiness",()=>{
 it("does not silently select Gemini because a Gemini credential happens to exist",()=>{
  const state=readJllmReasoningReadiness({GEMINI_API_KEY:"present",ANTHROPIC_API_KEY:"",JHADINA_REASONING_PROVIDER:undefined})
  expect(state).toMatchObject({selected:"anthropic",status:"NOT_CONFIGURED",alternativeAvailable:"gemini",generalReasoningReady:false})
 })
 it("explicit Gemini selection is only configuration readiness, not live proof",()=>{
  const state=readJllmReasoningReadiness({GEMINI_API_KEY:"present",ANTHROPIC_API_KEY:"",JHADINA_REASONING_PROVIDER:"gemini"})
  expect(state).toMatchObject({selected:"gemini",status:"CONFIGURED_UNVERIFIED",alternativeAvailable:null,generalReasoningReady:false})
  expect(JSON.stringify(state)).not.toContain("present")
 })
 it("a configured Anthropic key alone is not an authenticated successful answer",()=>{
  expect(readJllmReasoningReadiness({GEMINI_API_KEY:"",ANTHROPIC_API_KEY:"present",JHADINA_REASONING_PROVIDER:undefined}).generalReasoningReady).toBe(false)
 })
})

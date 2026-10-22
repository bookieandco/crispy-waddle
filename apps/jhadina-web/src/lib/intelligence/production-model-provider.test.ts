import {describe,it,expect} from "vitest"
import {readJllmReasoningReadiness,resolveJllmReasoningReceipt} from "./production-model-provider"
describe("explicit, zero-cost JLLM provider readiness",()=>{
 it("does not silently select Gemini because a Gemini credential happens to exist",()=>{
  const state=readJllmReasoningReadiness({GEMINI_API_KEY:"present",ANTHROPIC_API_KEY:"",JHADINA_REASONING_PROVIDER:undefined})
  expect(state).toMatchObject({selected:"local",status:"NOT_CONFIGURED",alternativeAvailable:"gemini",generalReasoningReady:false})
 })
 it("keeps audited MacBook blocked even with a plausible HTTPS endpoint",()=>{
  const status=readJllmReasoningReadiness({
   JHADINA_REASONING_PROVIDER:"local",JHADINA_LOCAL_MODEL_HOST_ID:"owner-m1-macbook",
   JHADINA_LOCAL_MODEL_URL:"https://approved-lab.example",
   JHADINA_LOCAL_MODEL_ALLOWED_HOST:"approved-lab.example",
   JHADINA_LOCAL_MODEL_NAME:"qwen3:4b",
   JHADINA_LOCAL_MODEL_GATEWAY_TOKEN:"not-a-real-secret",
   NODE_ENV:"production",
  })
  expect(status).toMatchObject({
   selected:"local",status:"NOT_CONFIGURED",localHostReadiness:"AUDIT_REPAIR_PENDING",
   generalReasoningReady:false,macbookAudit:{diagnosisVerified:false,inferenceReady:false},
  })
  expect(JSON.stringify(status)).not.toContain("not-a-real-secret")
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

describe("per-turn source verification",()=>{
 it("reports actual primary response without inventing source verification",()=>{
  expect(resolveJllmReasoningReceipt("gemini",[])).toEqual({
   provider:"gemini",mode:"MODEL_RESPONSE",externallyVerified:false,
   note:expect.stringMatching(/external facts/),
  })
 })
 it("makes legacy fallback visible instead of claiming generative reasoning",()=>{
  expect(resolveJllmReasoningReceipt("local",["primary_failed","fallback_used"])).toMatchObject({
   provider:"legacy-classifier",mode:"CLASSIFICATION_ONLY",externallyVerified:false,
  })
 })
})

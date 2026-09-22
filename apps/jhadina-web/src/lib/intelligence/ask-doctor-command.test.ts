import { describe,it } from "node:test"
import assert from "node:assert/strict"
import { inspectAskDoctorIntent } from "./ask-doctor-command"

describe("Ask Jhadina Doctor bridge",()=>{
  it("routes explicit repair language to proposal only",()=>{
    const intent=inspectAskDoctorIntent("Jhadina, Sports is broken. Fix it.")
    assert.equal(intent?.subsystemId,"sports")
    assert.equal(intent?.intent,"propose_repair")
    assert.equal(intent?.explicitApproval,false)
  })
  it("routes diagnosis without repair",()=>{
    const intent=inspectAskDoctorIntent("what's wrong with money?")
    assert.equal(intent?.subsystemId,"money")
    assert.equal(intent?.intent,"diagnose_subsystem")
  })
  it("does not hijack ordinary chat",()=>{
    assert.equal(inspectAskDoctorIntent("show me my growth campaigns"),null)
  })
})

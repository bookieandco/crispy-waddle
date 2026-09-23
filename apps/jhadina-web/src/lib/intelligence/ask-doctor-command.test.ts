import {describe,expect,it} from "vitest"
import { inspectAskDoctorIntent } from "./ask-doctor-command"

describe("Ask Jhadina Doctor bridge",()=>{
  it("routes explicit repair language to proposal only",()=>{
    const intent=inspectAskDoctorIntent("Jhadina, Sports is broken. Fix it.")
    expect(intent?.subsystemId).toBe("sports")
    expect(intent?.intent).toBe("propose_repair")
    expect(intent?.explicitApproval).toBe(false)
  })
  it("routes diagnosis without repair",()=>{
    const intent=inspectAskDoctorIntent("what's wrong with money?")
    expect(intent?.subsystemId).toBe("money")
    expect(intent?.intent).toBe("diagnose_subsystem")
  })
  it("does not hijack ordinary chat",()=>{
    expect(inspectAskDoctorIntent("show me my growth campaigns")).toBeNull()
  })
})

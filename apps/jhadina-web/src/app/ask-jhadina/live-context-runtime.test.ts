import { describe, expect, it } from "vitest"
import { buildLiveContext, isMeaningfulScreenChange, restoreWorkSessionContinuity } from "./live-context-runtime"

describe("JHADINA-LIVE-CONTEXT runtime", () => {
  it("bounds recent turns and carries active WorkSession continuity", () => {
    const turns=Array.from({length:12},(_,index)=>({
      id:`turn-${index}`,
      speaker:index%2===0?"user" as const:"jhadina" as const,
      text:`turn ${index}`,
      createdAt:`2026-09-23T00:00:${String(index).padStart(2,"0")}.000Z`,
      turnId:`turn-${index}`,
    }))
    const live=buildLiveContext(turns,{
      id:"session-1",
      goal:"Compare this screen to the earlier one.",
      activeSubsystems:["social","director"],
      admittedArtifactIds:["artifact-1","artifact-2"],
    })

    expect(live.source).toBe("ask-jhadina-live")
    expect(live.recentTurns).toHaveLength(8)
    expect(live.recentTurns[0]?.id).toBe("turn-4")
    expect(live.workSession).toEqual({
      id:"session-1",
      goal:"Compare this screen to the earlier one.",
      activeSubsystems:["social","director"],
      admittedArtifactIds:["artifact-1","artifact-2"],
    })
  })

  it("restores only admitted WorkSession artifacts and bounded subsystem context", () => {
    expect(restoreWorkSessionContinuity({
      goal:"Continue the campaign review",
      activeSubsystems:["growth","social"],
      artifactRefs:[
        {id:"artifact-clean",admitted:true},
        {id:"artifact-blocked",admitted:false},
      ],
    })).toEqual({
      goal:"Continue the campaign review",
      activeSubsystems:["growth","social"],
      admittedArtifactIds:["artifact-clean"],
    })
  })

  it("suppresses near-identical screen samples", () => {
    const previous=new Uint8Array([100,100,100,100])
    expect(isMeaningfulScreenChange(previous,new Uint8Array([102,99,101,100]))).toBe(false)
    expect(isMeaningfulScreenChange(previous,new Uint8Array([140,140,140,140]))).toBe(true)
  })

  it("treats first or differently-sized screen samples as distinct", () => {
    expect(isMeaningfulScreenChange(null,new Uint8Array([1,2,3]))).toBe(true)
    expect(isMeaningfulScreenChange(new Uint8Array([1,2]),new Uint8Array([1,2,3]))).toBe(true)
  })
})

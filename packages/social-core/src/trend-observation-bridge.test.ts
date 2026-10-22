import { describe, expect, it } from "vitest"
import type { SocialObservation } from "./observations.js"
import { socialObservationsToRelayTrends } from "./trend-observation-bridge.js"

const owner="owner-1", now="2026-10-21T12:00:00Z"
const base: SocialObservation = {
  id: "trend-a", userId: owner, brand: "pupsonstuff",
  kind: "trend", platform: "instagram", source: "owner-supplied",
  sourceUrl: "https://example.com/reference", observedAt: now,
  evidence: ["source:1"],
  attributes: { topic: "dog portrait gift", pattern: "before-after", format: "short_video" },
}
function convert(observations: SocialObservation[], authorizedObservationIds=new Set<string>()) {
  return socialObservationsToRelayTrends({
    observations, ownerUserId:owner,brand:"pupsonstuff",now,authorizedObservationIds,
  })
}
describe("Social trend admission bridge",()=>{
  it("keeps a manual observation manual; only trusted ID changes its provenance",()=>{
    expect(convert([base])[0].source).toBe("owner_submitted")
    expect(convert([base],new Set(["trend-a"]))[0].source).toBe("authorized_observation")
  })
  it("rejects foreign, future, empty evidence, and invalid URL observations",()=>{
    expect(convert([
      {...base,userId:"foreign"}, {...base,id:"other",brand:"jhadina"},
      {...base,id:"future",observedAt:"2027-01-01T00:00:00Z"},
      {...base,id:"unverified",evidence:[]},
      {...base,id:"unsafe",sourceUrl:"file:///etc/passwd"},
    ])).toHaveLength(0)
  })
  it("deduplicates and caps to 30 without provider calls",()=>{
    expect(convert([base,base])).toHaveLength(1)
    const many=Array.from({length:40},(_,i)=>({...base,id:"obs-"+i}))
    expect(convert(many)).toHaveLength(15)
  })
})

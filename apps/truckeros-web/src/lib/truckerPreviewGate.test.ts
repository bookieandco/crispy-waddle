import {describe,expect,it} from "vitest"
import {legacyApiBlocked} from "./truckerPreviewGate"

describe("TruckerOS public driver API launch gate",()=>{
  it("rejects every unauthenticated prototype API in production",()=>{
    const paths=[
      "/api/driver","/api/location","/api/dispatcher","/api/funfinder/search",
      "/api/interactions","/api/memory","/api/saved-places","/api/places/unknown",
      "/api/community","/api/community/moderation","/api/audit",
    ]
    for(const path of paths)expect(legacyApiBlocked(path,"production")).toBe(true)
  })
  it("allows health probes only, without accidentally opening driver data",()=>{
    expect(legacyApiBlocked("/api/health","production")).toBe(false)
    expect(legacyApiBlocked("/api/health/driver","production")).toBe(true)
  })
  it("permits isolated development preview without altering production policy",()=>{
    expect(legacyApiBlocked("/api/dispatcher","development")).toBe(false)
    expect(legacyApiBlocked("/api/community","test")).toBe(false)
  })
})

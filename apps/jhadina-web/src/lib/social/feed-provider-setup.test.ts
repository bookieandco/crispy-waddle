import {describe,expect,it} from "vitest"
import {SOCIAL_FEED_TARGETS,feedReadiness} from "./feed-provider-setup"

describe("social feed source onboarding",()=>{
 it("exposes unique provider options without treating them as connected",()=>{
  expect(new Set(SOCIAL_FEED_TARGETS.map(x=>x.id)).size).toBe(SOCIAL_FEED_TARGETS.length)
  expect(SOCIAL_FEED_TARGETS.length).toBeGreaterThanOrEqual(10)
  expect(SOCIAL_FEED_TARGETS.every(x=>x.limitation.length>0)).toBe(true)
 })
 it("never upgrades a publisher registry profile to a live feed",()=>{
  const fb=SOCIAL_FEED_TARGETS.find(x=>x.id==="facebook")!
  const status=feedReadiness(fb,{registeredProfiles:[{platform:"facebook",status:"connected"}]})
  expect(status.kind).toBe("limited")
  expect(status.details).toMatch(/unverified/)
 })
 it("keeps public author previews distinct from linked accounts",()=>{
  const bsky=SOCIAL_FEED_TARGETS.find(x=>x.id==="bluesky")!
  expect(feedReadiness(bsky,{})).toMatchObject({kind:"limited",label:"Public preview available"})
 })
 it("fails closed when OAuth status cannot be determined",()=>{
  const yt=SOCIAL_FEED_TARGETS.find(x=>x.id==="youtube")!
  expect(feedReadiness(yt,{youtubeStatusUnavailable:true}).kind).toBe("error")
  expect(feedReadiness(yt,{youtubeConfigured:false}).kind).toBe("pending")
  expect(feedReadiness(yt,{youtubeConnected:true}).details).toContain("cookie alone")
 })
 it("does not mark unrelated providers as signed in",()=>{
  const tiktok=SOCIAL_FEED_TARGETS.find(x=>x.id==="tiktok")!
  expect(feedReadiness(tiktok,{registeredProfiles:[{platform:"tiktok",status:"connected"}]}).kind).toBe("pending")
 })
})

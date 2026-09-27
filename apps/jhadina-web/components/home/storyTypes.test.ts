import { describe,expect,it } from "vitest"
import { HOME_FEED_SOURCES,storyMatchesSource,type Story } from "./storyTypes"

describe("Jhadina Home unified feed",()=>{
 it("keeps social, media and major subsystem sources in the scroll",()=>{
  expect(HOME_FEED_SOURCES).toEqual(expect.arrayContaining([
   "All","Social","TikTok","Facebook","Snapchat","Instagram","YouTube","Reddit","X","LinkedIn","Threads","Bluesky","Tumblr","VK","Director","JhadinaTV","Opportunities","Money","Sports","PupsonStuff",
  ]))
 })
 it("filters without losing provenance identity",()=>{
  const story:Story={id:"1",kind:"social",source:"Instagram",title:"Observed post",body:"Evidence-backed"}
  expect(storyMatchesSource(story,"All")).toBe(true)
  expect(storyMatchesSource(story,"Instagram")).toBe(true)
  expect(storyMatchesSource(story,"TikTok")).toBe(false)
 })
})

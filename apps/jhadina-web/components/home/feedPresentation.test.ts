import {describe,expect,it} from "vitest"
import {selectHomeStories,storyInView} from "./feedPresentation"
import type {Story} from "./storyTypes"
const story=(id:string,source:Story["source"],occurredAt?:string):Story=>({id,source,kind:source==="YouTube"?"youtube":"social",title:id,body:"Evidence only",occurredAt})
describe("Connected Home feed presentation",()=>{
 it("orders observed events before undated catalog cards without inventing times",()=>{
  expect(selectHomeStories([story("old","Social","2026-10-15T12:00:00Z"),story("catalog","JhadinaTV"),story("new","YouTube","2026-10-17T12:00:00Z")],"updates").map(x=>x.id)).toEqual(["new","old","catalog"])
 })
 it("filters social, watch and work without relabeling platforms",()=>{
  expect(storyInView(story("1","Instagram"),"social")).toBe(true)
  expect(storyInView(story("1","YouTube"),"watch")).toBe(true)
  expect(storyInView(story("1","Money"),"work")).toBe(true)
  expect(selectHomeStories([story("1","Instagram"),story("2","YouTube")],"updates","YouTube").map(x=>x.source)).toEqual(["YouTube"])
 })
 it("deduplicates within a platform and excludes shortcuts from observed feed",()=>{
  const first=story("same","Social","2026-10-17T12:00:00Z")
  expect(selectHomeStories([first,first,{...story("shortcut","Money"),isShortcut:true}],"updates")).toHaveLength(1)
 })
})

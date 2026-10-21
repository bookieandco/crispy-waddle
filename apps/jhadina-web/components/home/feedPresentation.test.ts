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
 it("balances across source lanes without inventing chronology or losing platform identity",()=>{
  const posts=[story("a","YouTube","2026-10-17T13:00:00Z"),
    story("b","YouTube","2026-10-17T12:00:00Z"),
    story("c","YouTube","2026-10-17T11:00:00Z"),
    story("d","Instagram","2026-10-17T10:00:00Z")]
  expect(selectHomeStories(posts,"updates","All","latest").map(x=>x.id)).toEqual(["a","b","c","d"])
  expect(selectHomeStories(posts,"updates","All","balanced").map(x=>x.id)).toEqual(["a","d","b","c"])
 })
 it("deduplicates within a platform and excludes shortcuts from observed feed",()=>{
  const first=story("same","Social","2026-10-17T12:00:00Z")
  expect(selectHomeStories([first,first,{...story("shortcut","Money"),isShortcut:true}],"updates")).toHaveLength(1)
 })
})

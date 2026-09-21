import { describe,expect,it } from "vitest"
import { JHADINA_WORLDS,getWorld,worldAssistantHref } from "./jhadina-world-registry"

describe("Jhadina world registry",()=>{
 it("keeps the major user-facing subsystems reachable",()=>{
  const required=[
   "assistant","money","wallet","sports","safety","spatial","knowledge","studio","music","tv","social",
   "opportunities","overage","campaign","placement","pupsonstuff","pod","homebase","publishing","trucker",
   "cooking","shopping","radar",
  ]
  const ids=new Set(JHADINA_WORLDS.map(world=>world.id))
  for(const id of required)expect(ids.has(id as never)).toBe(true)
 })
 it("routes Ask Jhadina as the governed fallback for worlds without native UI",()=>{
  for(const world of JHADINA_WORLDS.filter(item=>item.access==="assistant")){
   expect(world.href).toBeUndefined()
   expect(worldAssistantHref(world)).toContain("/ask-jhadina?surface=")
  }
 })
 it("uses unique native routes",()=>{
  const hrefs=JHADINA_WORLDS.flatMap(world=>world.href?[world.href]:[])
  expect(new Set(hrefs).size).toBe(hrefs.length)
 })
 it("keeps Ask Jhadina and Social native",()=>{
  expect(getWorld("assistant")?.href).toBe("/ask-jhadina")
  expect(getWorld("social")?.href).toBe("/social")
 })
})

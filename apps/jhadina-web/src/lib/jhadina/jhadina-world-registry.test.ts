import { describe,expect,it } from "vitest"
import { JHADINA_WORLDS,getWorld,worldAssistantHref,worldDirectHref } from "./jhadina-world-registry"

describe("Jhadina world registry",()=>{
 it("keeps the major user-facing subsystems reachable",()=>{
  const required=[
   "assistant","money","wallet","sports","safety","spatial","knowledge","studio","music","tv","social",
   "opportunities","overage","campaign","placement","pupsonstuff","pod","homebase","publishing","trucker",
   "cooking","shopping","radar","evolution","staffing",
  ]
  const ids=new Set(JHADINA_WORLDS.map(world=>world.id))
  for(const id of required)expect(ids.has(id as never)).toBe(true)
 })
 it("gives every world a direct surface and keeps Ask Jhadina as the governed fallback",()=>{
  for(const world of JHADINA_WORLDS){
   expect(worldDirectHref(world)).toBeTruthy()
  }
  for(const world of JHADINA_WORLDS.filter(item=>item.access==="assistant")){
   expect(world.href).toBeUndefined()
   expect(worldDirectHref(world)).toBe("/worlds/"+world.id)
   expect(worldAssistantHref(world)).toContain("/ask-jhadina?surface=")
   expect(worldAssistantHref(world)).toContain(encodeURIComponent("/worlds/"+world.id))
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

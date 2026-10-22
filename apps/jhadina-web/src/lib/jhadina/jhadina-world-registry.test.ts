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

// Routing regression: a registered workspace must resolve in either Next router.
import { existsSync } from "node:fs"
import path from "node:path"
it("resolves every directory destination to an existing page",()=>{
 const app=path.resolve(__dirname,"../../app")
 const pages=path.resolve(__dirname,"../../../pages")
 for(const world of JHADINA_WORLDS){
  const href=worldDirectHref(world)
  const route=href==="/"?"index":href.slice(1)
  expect(existsSync(path.join(app,route,"page.tsx")) || existsSync(path.join(pages,route+".tsx")) || existsSync(path.join(pages,route,"index.tsx")) || (!world.href && existsSync(path.join(app,"worlds/[id]/page.tsx"))),href).toBe(true)
 }
 expect(getWorld("sports")?.href).toBe("/sports-lab")
})

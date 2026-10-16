import { describe,expect,it } from "vitest"
import { JHADINA_WORLDS,getWorld,projectWorldCapability,worldAssistantHref,worldDirectHref } from "./jhadina-world-registry"

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
 it("never treats a route as proof of a commissioned action",()=>{
  for(const world of JHADINA_WORLDS)for(const c of world.capabilities){
    expect(c.enabled).toBe(false)
    expect(c.status).toBe("unverified")
  }
  const evidence={commissioned:true,healthy:true,authorized:true,executable:true,sourceSha:"abcdef1",observedAt:"2026-10-16T16:00:00.000Z"}
  const now=Date.parse("2026-10-16T16:01:00.000Z")
  expect(projectWorldCapability("research",evidence,now).status).toBe("ready")
  expect(projectWorldCapability("research",{...evidence,authorized:false},now).enabled).toBe(false)
  expect(projectWorldCapability("research",{...evidence,observedAt:"2026-10-16T15:00:00.000Z"},now).status).toBe("stale")
  expect(projectWorldCapability("research",{...evidence,sourceSha:""},now).enabled).toBe(false)
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

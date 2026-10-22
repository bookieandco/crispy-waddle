import {describe,it,expect} from "vitest"
import {getNoHostOperatingPlan} from "./no-host-operating-plan"
import {JHADINA_WORLDS} from "@/lib/jhadina/jhadina-world-registry"
describe("no-Mac Ask operating mode",()=>{
 it("uses only existing canonical world hrefs and grants zero execution authority",()=>{
  const plan=getNoHostOperatingPlan()
  expect(plan).toMatchObject({
   mode:"NO_VERIFIED_REASONING_HOST",liveGeneralModel:false,automaticCloudFallback:false,
   executionAuthority:"NONE",publicLookup:"USER_TRIGGERED_ONLY",
  })
  expect(plan.workspaces.length).toBeGreaterThan(0)
  for(const world of plan.workspaces){
   const canonical=JHADINA_WORLDS.find(entry=>entry.id===world.id)
   expect(canonical?.href).toBe(world.href)
   expect(world.access).toBe("NAVIGATION_ONLY")
   expect(world.href.startsWith("/")).toBe(true)
  }
  expect(plan.workspaces.some(world=>world.id==="wallet")).toBe(false)
  expect(plan.workspaces.some(world=>world.id==="money")).toBe(false)
 })
})

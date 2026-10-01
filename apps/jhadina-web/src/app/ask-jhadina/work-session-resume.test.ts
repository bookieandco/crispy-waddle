import {describe,expect,it,vi} from "vitest"
import {rememberWorkSession,resumeOwnerWorkSession,workSessionPointerKey} from "./work-session-resume"

function storage(seed:Record<string,string>={}) {
 const rows=new Map(Object.entries(seed))
 return {rows,getItem:(key:string)=>rows.get(key)??null,setItem:(key:string,value:string)=>{rows.set(key,value)}}
}
function input(store=storage()) {
 return {ownerUserId:"owner-a",storage:store,fetchSession:vi.fn(async(id:string):Promise<unknown|null>=>({id,ownerUserId:"owner-a",goal:"resume"})),createId:()=>"new-id"}
}

describe("owner session resume",()=>{
 it("uses only the current owner's pointer",async()=>{
  const store=storage({[workSessionPointerKey("owner-a")]:"a-session",[workSessionPointerKey("owner-b")]:"b-session"})
  const deps=input(store)
  expect((await resumeOwnerWorkSession(deps)).id).toBe("a-session")
  expect(deps.fetchSession).toHaveBeenCalledWith("a-session")
  expect(store.getItem(workSessionPointerKey("owner-b"))).toBe("b-session")
 })
 it("migrates a legacy pointer only after the server confirms ownership",async()=>{
  const store=storage({"jhadina:work-session":"old-session"})
  await resumeOwnerWorkSession(input(store))
  expect(store.getItem(workSessionPointerKey("owner-a"))).toBe("old-session")
  expect(store.getItem(workSessionPointerKey("owner-b"))).toBeNull()
 })
 it("does not reuse an inaccessible legacy or URL ID",async()=>{
  const deps={...input(storage({"jhadina:work-session":"foreign"})),requestedSessionId:"foreign"}
  deps.fetchSession.mockResolvedValue(null)
  expect(await resumeOwnerWorkSession(deps)).toEqual({id:"new-id",session:null,unavailable:true})
  expect(deps.storage.getItem(workSessionPointerKey("owner-a"))).toBeNull()
 })
 it("keeps the existing pointer on an outage rather than claiming a fresh session",async()=>{
  const deps=input(storage({[workSessionPointerKey("owner-a")]:"saved"}))
  deps.fetchSession.mockRejectedValue(new Error("offline"))
  await expect(resumeOwnerWorkSession(deps)).rejects.toThrow("offline")
  expect(deps.storage.getItem(workSessionPointerKey("owner-a"))).toBe("saved")
 })
 it("rejects mismatched owner or ID in an apparently successful response",async()=>{
  for(const bad of [{id:"saved",ownerUserId:"owner-b"},{id:"other",ownerUserId:"owner-a"},"malformed"]){
   const deps=input(storage({"jhadina:work-session":"saved"}))
   deps.fetchSession.mockResolvedValue(bad)
   await expect(resumeOwnerWorkSession(deps)).rejects.toThrow("RESTORE_UNVERIFIED")
   expect(deps.storage.getItem(workSessionPointerKey("owner-a"))).toBeNull()
  }
 })
 it("works with unavailable browser storage and does not fetch a guessed ID",async()=>{
  const deps={...input(),storage:{getItem:()=>{throw new Error("denied")},setItem:()=>{throw new Error("denied")}}}
  expect((await resumeOwnerWorkSession(deps)).id).toBe("new-id")
  expect(deps.fetchSession).not.toHaveBeenCalled()
  expect(()=>rememberWorkSession(deps.storage,"owner-a","saved")).not.toThrow()
 })
 it("gives explicit session links precedence over remembered state",async()=>{
  const deps={...input(storage({[workSessionPointerKey("owner-a")]:"saved"})),requestedSessionId:"linked"}
  expect((await resumeOwnerWorkSession(deps)).id).toBe("linked")
  expect(deps.storage.getItem(workSessionPointerKey("owner-a"))).toBe("linked")
 })
})

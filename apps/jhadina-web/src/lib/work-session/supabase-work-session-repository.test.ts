import {describe,expect,it} from "vitest"
import type {SupabaseClient} from "@supabase/supabase-js"
import type {JhadinaWorkSession} from "@jhadina/core-spine"
import {SupabaseWorkSessionRepository} from "./supabase-work-session-repository"

function session(ownerUserId="owner-a"):JhadinaWorkSession{
 return {id:"ws-1",ownerUserId,goal:"finish Jhadina",status:"active",
  activeSubsystems:["jllm"],artifactRefs:[],decisionRefs:["decision-1"],outputRefs:[],
  createdAt:"2026-09-22T00:00:00Z",updatedAt:"2026-09-22T00:01:00Z"}
}

// Stateful database double: conflicts and owner filters affect the stored row,
// so passing a caller-owned object cannot disguise a foreign database owner.
function database(){
 const rows=new Map<string,Record<string,unknown>>()
 let failWrites=false
 const api={from:()=>({
  upsert:async(value:Record<string,unknown>,options:{ignoreDuplicates?:boolean})=>{
   if(failWrites)return {error:{message:"offline"}}
   if(!rows.has(String(value.id))||!options.ignoreDuplicates)rows.set(String(value.id),{...value})
   return {error:null}
  },
  select:()=>query(),
  update:(patch:Record<string,unknown>)=>query(patch),
 })} as unknown as SupabaseClient
 function query(patch?:Record<string,unknown>){
  const filters:Record<string,unknown>={}
  const chain={
   eq:(key:string,value:unknown)=>{filters[key]=value;return chain},
   select:()=>chain,
   maybeSingle:async()=>{
    if(patch&&failWrites)return {data:null,error:{message:"offline"}}
    const row=[...rows.values()].find(row=>Object.entries(filters).every(([key,value])=>row[key]===value))
    if(row&&patch)Object.assign(row,patch)
    return {data:row?{...row}:null,error:null}
   },
  }
  return chain
 }
 return {api,rows,fail:()=>{failWrites=true}}
}

describe("SupabaseWorkSessionRepository",()=>{
 it("creates and rehydrates owner-scoped durable state",async()=>{
  const db=database(),repo=new SupabaseWorkSessionRepository(db.api,"owner-a")
  await repo.save(session())
  await expect(repo.get("ws-1")).resolves.toEqual(session())
  await expect(new SupabaseWorkSessionRepository(db.api,"owner-b").get("ws-1")).resolves.toBeNull()
 })
 it("updates only the owner's session and preserves its creation time",async()=>{
  const db=database(),repo=new SupabaseWorkSessionRepository(db.api,"owner-a")
  await repo.save(session())
  await repo.save({...session(),goal:"continue",createdAt:"2026-10-01T00:00:00Z"})
  await expect(repo.get("ws-1")).resolves.toMatchObject({goal:"continue",createdAt:session().createdAt})
 })
 it("rejects a caller-owned object targeting another owner's existing ID",async()=>{
  const db=database()
  await new SupabaseWorkSessionRepository(db.api,"owner-a").save(session())
  const before=structuredClone(db.rows.get("ws-1"))
  await expect(new SupabaseWorkSessionRepository(db.api,"owner-b").save({...session("owner-b"),goal:"overwrite"})).rejects.toThrow("WORK_SESSION_NOT_FOUND")
  expect(db.rows.get("ws-1")).toEqual(before)
 })
 it("rejects cross-owner writes before persistence",async()=>{
  const db=database(),repo=new SupabaseWorkSessionRepository(db.api,"owner-a")
  await expect(repo.save(session("owner-b"))).rejects.toThrow("WORK_SESSION_OWNER_MISMATCH")
  expect(db.rows.size).toBe(0)
 })
 it("propagates storage failures without claiming a save",async()=>{
  const db=database(),repo=new SupabaseWorkSessionRepository(db.api,"owner-a")
  db.fail()
  await expect(repo.save(session())).rejects.toThrow("WORK_SESSION_WRITE_FAILED")
  expect(db.rows.size).toBe(0)
 })
})

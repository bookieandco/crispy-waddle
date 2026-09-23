import {describe,expect,it} from "vitest"
import {SupabaseWorkSessionRepository} from "./supabase-work-session-repository"

function client(row:any=null){
 const writes:any[]=[]
 return {
  writes,
  api:{
   from:()=>({
    select:()=>({eq:()=>({eq:()=>({maybeSingle:async()=>({data:row,error:null})})})}),
    upsert:async(value:any)=>{writes.push(value);return{error:null}},
   }),
  } as any,
 }
}

describe("SupabaseWorkSessionRepository",()=>{
 it("rehydrates owner-scoped durable state",async()=>{
  const {api}=client()
  const row={
   id:"ws-1",owner_user_id:"00000000-0000-0000-0000-000000000001",goal:"finish JLLM",
   status:"active",active_subsystems:["jllm"],artifact_refs:[],decision_refs:["decision-1"],output_refs:[],
   created_at:"2026-09-22T00:00:00Z",updated_at:"2026-09-22T00:01:00Z",
  }
  ;(api.from as any)=()=>({select:()=>({eq:()=>({eq:()=>({maybeSingle:async()=>({data:row,error:null})})})})})
  const repo=new SupabaseWorkSessionRepository(api,row.owner_user_id)
  await expect(repo.get("ws-1")).resolves.toMatchObject({id:"ws-1",goal:"finish JLLM",decisionRefs:["decision-1"]})
 })

 it("rejects cross-owner writes before persistence",async()=>{
  const {api,writes}=client()
  const repo=new SupabaseWorkSessionRepository(api,"owner-a")
  await expect(repo.save({
   id:"ws-2",ownerUserId:"owner-b",goal:"x",status:"active",
   activeSubsystems:[],artifactRefs:[],decisionRefs:[],outputRefs:[],
   createdAt:"2026-09-22T00:00:00Z",updatedAt:"2026-09-22T00:00:00Z",
  })).rejects.toThrow("WORK_SESSION_OWNER_MISMATCH")
  expect(writes).toHaveLength(0)
 })
})

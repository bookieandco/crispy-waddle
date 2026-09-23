import {NextRequest,NextResponse} from "next/server"
import {createWorkSession,evolveWorkSession,type JhadinaWorkSession} from "@jhadina/core-spine"
import {createRequestIdentityVerifier} from "@/lib/auth/request-identity"
import {createServiceRoleClient} from "@/lib/supabase/service-role"
import {SupabaseWorkSessionRepository} from "@/lib/work-session/supabase-work-session-repository"

export const runtime="nodejs"

async function context(req:NextRequest,id:string){
 const claimed=req.headers.get("x-jhadina-user-id")||""
 if(!claimed)throw new Error("WORK_SESSION_IDENTITY_REQUIRED")
 const identity=await (await createRequestIdentityVerifier()).verify({userId:claimed})
 const client=createServiceRoleClient()
 if(!client)throw new Error("WORK_SESSION_STORAGE_NOT_CONFIGURED")
 return {identity,repo:new SupabaseWorkSessionRepository(client,identity.userId),id}
}

export async function GET(req:NextRequest,route:{params:Promise<{id:string}>}){
 try{
  const {id}=await route.params
  const {repo}=await context(req,id)
  const session=await repo.get(id)
  if(!session)return NextResponse.json({success:false,error:"WORK_SESSION_NOT_FOUND"},{status:404})
  return NextResponse.json({success:true,session})
 }catch(error){return fail(error)}
}

export async function PUT(req:NextRequest,route:{params:Promise<{id:string}>}){
 try{
  const {id}=await route.params
  const {identity,repo}=await context(req,id)
  const body=await req.json() as {
   goal?:unknown
   status?:unknown
   activeSubsystems?:unknown
   artifactRefs?:unknown
   decisionRefs?:unknown
   outputRefs?:unknown
  }
  const goal=typeof body.goal==="string"?body.goal.trim().slice(0,4000):""
  const current=await repo.get(id)
  let session:JhadinaWorkSession
  if(!current){
   if(!goal)throw new Error("WORK_SESSION_GOAL_REQUIRED")
   session=createWorkSession({id,ownerUserId:identity.userId,goal})
  }else{
   const statuses=new Set(["active","waiting-approval","completed","abandoned"])
   const status=typeof body.status==="string"&&statuses.has(body.status)?body.status as JhadinaWorkSession["status"]:undefined
   const strings=(value:unknown,max=32)=>Array.isArray(value)?value.filter((v):v is string=>typeof v==="string"&&Boolean(v.trim())).slice(0,max):undefined
   session=evolveWorkSession(current,{
    ...(status?{status}:{}),
    ...(strings(body.activeSubsystems)?{activeSubsystems:strings(body.activeSubsystems)}:{}),
    ...(strings(body.decisionRefs,64)?{decisionRefs:strings(body.decisionRefs,64)}:{}),
    ...(strings(body.outputRefs,64)?{outputRefs:strings(body.outputRefs,64)}:{}),
    ...(Array.isArray(body.artifactRefs)?{artifactRefs:body.artifactRefs.slice(0,32).filter((v):v is JhadinaWorkSession["artifactRefs"][number]=>Boolean(v&&typeof v==="object"&&typeof (v as {id?:unknown}).id==="string"))}:{}),
   })
   if(goal&&goal!==current.goal)session={...session,goal}
  }
  await repo.save(session)
  const persisted=await repo.get(id)
  if(!persisted)throw new Error("WORK_SESSION_VERIFY_FAILED")
  return NextResponse.json({success:true,session:persisted})
 }catch(error){return fail(error)}
}

function fail(error:unknown){
 const message=error instanceof Error?error.message:"Work session failed"
 const status=/IDENTITY|identity|session/.test(message)?401:/NOT_FOUND/.test(message)?404:/REQUIRED/.test(message)?400:503
 return NextResponse.json({success:false,error:message},{status})
}

import { NextResponse } from "next/server"
import { applyTimelineCommand,timelineCommandReason,type TimelineCommand } from "@jhadina/director-core/timeline-command"
import type { EditableTimeline,TimelineSnapshot,TimelineVersion } from "@jhadina/director-core/timeline-model"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

type HistoryCommand=TimelineCommand|{type:"undo";targetVersionId?:string}|{type:"redo";targetVersionId:string}

function snapshot(timeline:EditableTimeline):TimelineSnapshot{
 return {tracks:timeline.tracks,transitions:timeline.transitions,markers:timeline.markers,playheadSeconds:timeline.playheadSeconds}
}
function withSnapshot(timeline:EditableTimeline,version:TimelineVersion):EditableTimeline{
 return {...timeline,versions:[...timeline.versions,version]}
}
function baseline(timeline:EditableTimeline,userId:string):EditableTimeline{
 if(timeline.versions.length)return timeline
 const id=crypto.randomUUID()
 return {...timeline,versions:[{id,version:0,createdAt:new Date().toISOString(),createdBy:"user",message:"Timeline baseline",snapshotHash:id+":0:"+userId,snapshot:snapshot(timeline)}]}
}
function restore(timeline:EditableTimeline,targetId:string,kind:"undo"|"redo",userId:string){
 const target=timeline.versions.find(version=>version.id===targetId)
 if(!target?.snapshot)throw new Error("DIRECTOR_TIMELINE_HISTORY_SNAPSHOT_MISSING")
 const current=timeline.versions.at(-1)
 const version=(current?.version??0)+1
 const id=crypto.randomUUID()
 const restored:EditableTimeline={...timeline,...target.snapshot,versions:timeline.versions}
 const entry:TimelineVersion={id,version,parentVersionId:current?.id,createdAt:new Date().toISOString(),createdBy:"user",message:kind==="undo"?"Undo timeline edit":"Redo timeline edit",snapshotHash:id+":"+version+":"+userId,snapshot:target.snapshot,...(kind==="undo"?{revertsVersionId:current?.id}:{restoresVersionId:target.id})}
 return withSnapshot(restored,entry)
}
async function canonicalizeGeneratedAsset(command:Extract<TimelineCommand,{type:"insert-generated-asset"}>,timeline:EditableTimeline,userId:string):Promise<TimelineCommand>{
 const privileged=createServiceRoleClient()
 if(!privileged)throw new Error("DIRECTOR_ASSET_STORE_NOT_CONFIGURED")
 const assetId=command.asset.assetId
 const approvalId="approval:"+assetId+":"+userId
 const [{data:asset,error:assetError},{data:approval,error:approvalError}]=await Promise.all([
  privileged.from("director_generated_editing_assets").select("id,project_id,generation_job_id,media_type,uri,mime_type,metadata").eq("id",assetId).eq("project_id",timeline.projectId).maybeSingle(),
  privileged.from("director_editing_asset_approvals").select("asset_id,approval_id,approved_at").eq("asset_id",assetId).eq("approval_id",approvalId).maybeSingle(),
 ])
 if(assetError)throw new Error("DIRECTOR_ASSET_READ_FAILED:"+assetError.message)
 if(approvalError)throw new Error("DIRECTOR_ASSET_APPROVAL_READ_FAILED:"+approvalError.message)
 if(!asset)throw new Error("DIRECTOR_ASSET_NOT_FOUND_FOR_PROJECT")
 if(!approval)throw new Error("DIRECTOR_ASSET_APPROVAL_REQUIRED")
 const metadata=(asset.metadata??{}) as Record<string,unknown>
 return {type:"insert-generated-asset",asset:{
  assetId:String(asset.id),
  generationJobId:String(asset.generation_job_id),
  uri:String(asset.uri),
  mimeType:asset.mime_type?String(asset.mime_type):undefined,
  mediaType:asset.media_type,
  operationId:typeof metadata.operationId==="string"?metadata.operationId:undefined,
  sourceId:typeof metadata.sourceId==="string"?metadata.sourceId:command.asset.sourceId,
  startSeconds:command.asset.startSeconds,
  endSeconds:command.asset.endSeconds,
  metadata:{...metadata,approvalId:String(approval.approval_id),approvedAt:String(approval.approved_at)},
 }}
}

export async function POST(request:Request){
 try{
  const supabase=await createClient()
  const {data:{user}}=await supabase.auth.getUser()
  if(!user)return NextResponse.json({ok:false,error:"Authentication required"},{status:401})
  const body=await request.json() as {timeline?:EditableTimeline;command?:HistoryCommand}
  if(!body.timeline||!body.command)return NextResponse.json({ok:false,error:"timeline and command are required"},{status:400})
  let timeline=baseline(body.timeline,user.id)
  if(body.command.type==="undo"){
   const current=timeline.versions.at(-1)
   const targetId=body.command.targetVersionId??current?.parentVersionId
   if(!targetId)return NextResponse.json({ok:false,error:"No timeline version available to undo"},{status:409})
   return NextResponse.json({ok:true,status:"completed",timeline:restore(timeline,targetId,"undo",user.id)})
  }
  if(body.command.type==="redo"){
   return NextResponse.json({ok:true,status:"completed",timeline:restore(timeline,body.command.targetVersionId,"redo",user.id)})
  }
  if(body.command.type==="generative-region"||body.command.type==="generate-sfx"){
   return NextResponse.json({ok:false,status:"approval_required",error:"DIRECTOR_GENERATIVE_MUTATION_REQUIRES_DURABLE_APPROVAL"},{status:409})
  }
  const command=body.command.type==="insert-generated-asset"?await canonicalizeGeneratedAsset(body.command,timeline,user.id):body.command
  const next=applyTimelineCommand(timeline,command)
  const previous=timeline.versions.at(-1)
  const version=(previous?.version??0)+1
  const versionId=crypto.randomUUID()
  const entry:TimelineVersion={id:versionId,version,parentVersionId:previous?.id,createdAt:new Date().toISOString(),createdBy:"user",message:timelineCommandReason(command),snapshotHash:versionId+":"+version+":"+user.id,snapshot:snapshot(next)}
  timeline=withSnapshot(next,entry)
  return NextResponse.json({ok:true,status:"completed",timeline,audit:{event:"director.timeline.mutated",projectId:timeline.projectId,operation:command.type,versionId,version}})
 }catch(error){
  const message=error instanceof Error?error.message:"Timeline command failed"
  const status=message.includes("APPROVAL_REQUIRED")?409:message.includes("NOT_FOUND")?404:400
  return NextResponse.json({ok:false,error:message},{status})
 }
}

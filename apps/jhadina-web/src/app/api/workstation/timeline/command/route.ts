import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { applyTimelineCommand,timelineCommandReason,type TimelineCommand } from "@jhadina/director-core/timeline-command"
import type { EditableTimeline,TimelineSnapshot,TimelineVersion } from "@jhadina/director-core/timeline-model"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { requireDirectorProjectAuthority } from "@/lib/director-project-authority"
import { DirectorWorkstationTimelineRepository } from "@/lib/director-workstation-timeline-repository"

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
async function canonicalizeGeneratedAsset(command:Extract<TimelineCommand,{type:"insert-generated-asset"}>,timeline:EditableTimeline,privileged:SupabaseClient):Promise<TimelineCommand>{
 const assetId=command.asset.assetId
 const [{data:asset,error:assetError},{data:approval,error:approvalError}]=await Promise.all([
  privileged.from("director_generated_editing_assets").select("id,project_id,generation_job_id,media_type,uri,mime_type,metadata").eq("id",assetId).eq("project_id",timeline.projectId).maybeSingle(),
  privileged.from("director_editing_asset_approvals").select("asset_id,approval_id,approved_at,approved_by_user_id").eq("asset_id",assetId).maybeSingle(),
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
  metadata:{...metadata,approvalId:String(approval.approval_id),approvedAt:String(approval.approved_at),approvedByUserId:String(approval.approved_by_user_id)},
 }}
}

function statusFor(message:string):number{
 if(/ACCESS_DENIED|CAPABILITY_DENIED|EDIT_AUTHORITY_REQUIRED/.test(message))return 403
 if(/STALE_REVISION|APPROVAL_REQUIRED/.test(message))return 409
 if(/NOT_FOUND/.test(message))return 404
 return 400
}

export async function POST(request:Request){
 try{
  const supabase=await createClient()
  const {data:{user}}=await supabase.auth.getUser()
  if(!user)return NextResponse.json({ok:false,error:"Authentication required"},{status:401})
  const body=await request.json() as {projectId?:string;expectedRevision?:number;mutationId?:string;command?:HistoryCommand}
  const projectId=body.projectId?.trim()??""
  if(!projectId||!body.command)return NextResponse.json({ok:false,error:"projectId and command are required"},{status:400})
  if(!Number.isSafeInteger(body.expectedRevision)||Number(body.expectedRevision)<1){
   return NextResponse.json({ok:false,error:"DIRECTOR_TIMELINE_EXPECTED_REVISION_REQUIRED"},{status:400})
  }

  const privileged=createServiceRoleClient()
  if(!privileged)return NextResponse.json({ok:false,error:"DIRECTOR_PROJECT_STORE_NOT_CONFIGURED"},{status:503})
  await requireDirectorProjectAuthority(privileged,{projectId,userId:user.id,capability:"edit"})

  const repository=new DirectorWorkstationTimelineRepository(privileged)
  const record=await repository.load(projectId)
  if(!record)return NextResponse.json({ok:false,error:"DIRECTOR_TIMELINE_NOT_FOUND"},{status:404})
  let timeline=baseline(record.timeline,user.id)

  if(body.command.type==="generative-region"||body.command.type==="generate-sfx"){
   return NextResponse.json({ok:false,status:"approval_required",error:"DIRECTOR_GENERATIVE_MUTATION_REQUIRES_DURABLE_APPROVAL"},{status:409})
  }

  let reason:string
  if(body.command.type==="undo"){
   const current=timeline.versions.at(-1)
   const targetId=body.command.targetVersionId??current?.parentVersionId
   if(!targetId)return NextResponse.json({ok:false,error:"No timeline version available to undo"},{status:409})
   timeline=restore(timeline,targetId,"undo",user.id)
   reason="Undo timeline edit"
  }else if(body.command.type==="redo"){
   timeline=restore(timeline,body.command.targetVersionId,"redo",user.id)
   reason="Redo timeline edit"
  }else{
   const command=body.command.type==="insert-generated-asset"?await canonicalizeGeneratedAsset(body.command,timeline,privileged):body.command
   const next=applyTimelineCommand(timeline,command)
   const previous=timeline.versions.at(-1)
   const version=(previous?.version??0)+1
   const versionId=crypto.randomUUID()
   reason=timelineCommandReason(command)
   const entry:TimelineVersion={id:versionId,version,parentVersionId:previous?.id,createdAt:new Date().toISOString(),createdBy:"user",message:reason,snapshotHash:versionId+":"+version+":"+user.id,snapshot:snapshot(next)}
   timeline=withSnapshot(next,entry)
  }

  const saved=await repository.save({
   projectId,
   userId:user.id,
   expectedRevision:Number(body.expectedRevision),
   mutationId:body.mutationId?.trim()||crypto.randomUUID(),
   timeline,
   reason,
  })

  return NextResponse.json({
   ok:true,
   status:"completed",
   revision:saved.revision,
   timeline:saved.timeline,
   audit:{event:"director.timeline.mutated",projectId,operation:body.command.type,revision:saved.revision},
  })
 }catch(error){
  const message=error instanceof Error?error.message:"Timeline command failed"
  return NextResponse.json({ok:false,error:message},{status:statusFor(message)})
 }
}

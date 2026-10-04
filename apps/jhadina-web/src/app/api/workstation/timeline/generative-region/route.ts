import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { requireDirectorProjectAuthority } from '@/lib/director-project-authority';
import { DirectorWorkstationTimelineRepository } from '@/lib/director-workstation-timeline-repository';

function statusFor(message:string):number{
  if(/ACCESS_DENIED|CAPABILITY_DENIED/.test(message)) return 403;
  if(/NOT_FOUND/.test(message)) return 404;
  return 400;
}

export async function POST(request: Request) {
  try{
    const supabase=await createClient();
    const {data:{user}}=await supabase.auth.getUser();
    if(!user) return NextResponse.json({ok:false,error:'Authentication required'},{status:401});

    const body=await request.json() as {
      projectId?:string;
      clipId?:string;
      startSeconds?:number;
      durationSeconds?:number;
      instruction?:string;
      expectedRevision?:number;
    };
    const projectId=body.projectId?.trim()??'';
    const clipId=body.clipId?.trim()??'';
    const instruction=body.instruction?.trim()??'';
    if(!projectId||!clipId||!instruction||typeof body.startSeconds!=='number'||typeof body.durationSeconds!=='number'){
      return NextResponse.json({ok:false,error:'projectId, clipId, instruction, startSeconds and durationSeconds are required'},{status:400});
    }
    if(body.startSeconds<0||body.durationSeconds<=0){
      return NextResponse.json({ok:false,error:'DIRECTOR_GENERATIVE_REGION_RANGE_INVALID'},{status:400});
    }
    if(!Number.isSafeInteger(body.expectedRevision)||Number(body.expectedRevision)<1){
      return NextResponse.json({ok:false,error:'DIRECTOR_TIMELINE_EXPECTED_REVISION_REQUIRED'},{status:400});
    }

    const privileged=createServiceRoleClient();
    if(!privileged) return NextResponse.json({ok:false,error:'DIRECTOR_PROJECT_STORE_NOT_CONFIGURED'},{status:503});
    await requireDirectorProjectAuthority(privileged,{projectId,userId:user.id,capability:'edit'});

    const timeline=await new DirectorWorkstationTimelineRepository(privileged).load(projectId);
    if(!timeline) return NextResponse.json({ok:false,error:'DIRECTOR_TIMELINE_NOT_FOUND'},{status:404});
    if(timeline.revision!==body.expectedRevision){
      return NextResponse.json({ok:false,error:`DIRECTOR_TIMELINE_STALE_REVISION:expected=${body.expectedRevision} actual=${timeline.revision}`},{status:409});
    }
    const clipExists=timeline.timeline.tracks.some(track=>track.clips.some(clip=>clip.id===clipId));
    if(!clipExists) return NextResponse.json({ok:false,error:'DIRECTOR_GENERATIVE_REGION_CLIP_NOT_FOUND'},{status:404});

    const id=crypto.randomUUID();
    const now=new Date().toISOString();
    const {data,error}=await privileged.from('director_generative_region_proposals').insert({
      id,
      project_id:projectId,
      timeline_revision:timeline.revision,
      clip_id:clipId,
      start_seconds:body.startSeconds,
      duration_seconds:body.durationSeconds,
      instruction,
      status:'pending_approval',
      created_by_user_id:user.id,
      created_at:now,
      updated_at:now,
    }).select('id,project_id,timeline_revision,clip_id,start_seconds,duration_seconds,instruction,status,created_at').single();
    if(error) throw new Error(`DIRECTOR_GENERATIVE_REGION_WRITE_FAILED:${error.message}`);

    return NextResponse.json({ok:true,region:{
      id:String(data.id),
      projectId:String(data.project_id),
      timelineRevision:Number(data.timeline_revision),
      clipId:String(data.clip_id),
      startSeconds:Number(data.start_seconds),
      durationSeconds:Number(data.duration_seconds),
      instruction:String(data.instruction),
      status:data.status,
      createdAt:data.created_at,
    },requiresApproval:true},{status:202});
  }catch(error){
    const message=error instanceof Error?error.message:'DIRECTOR_GENERATIVE_REGION_FAILED';
    return NextResponse.json({ok:false,error:message},{status:statusFor(message)});
  }
}

export async function GET(request:Request) {
  try{
    const supabase=await createClient();
    const {data:{user}}=await supabase.auth.getUser();
    if(!user) return NextResponse.json({ok:false,error:'Authentication required'},{status:401});

    const projectId=new URL(request.url).searchParams.get('projectId')?.trim()??'';
    if(!projectId) return NextResponse.json({ok:false,error:'projectId is required'},{status:400});

    const privileged=createServiceRoleClient();
    if(!privileged) return NextResponse.json({ok:false,error:'DIRECTOR_PROJECT_STORE_NOT_CONFIGURED'},{status:503});
    await requireDirectorProjectAuthority(privileged,{projectId,userId:user.id,capability:'read'});

    const {data,error}=await privileged.from('director_generative_region_proposals')
      .select('id,project_id,timeline_revision,clip_id,start_seconds,duration_seconds,instruction,status,created_at')
      .eq('project_id',projectId)
      .order('created_at',{ascending:false});
    if(error) throw new Error(`DIRECTOR_GENERATIVE_REGION_READ_FAILED:${error.message}`);

    return NextResponse.json({ok:true,regions:(data??[]).map(row=>({
      id:String(row.id),projectId:String(row.project_id),timelineRevision:Number(row.timeline_revision),
      clipId:String(row.clip_id),startSeconds:Number(row.start_seconds),durationSeconds:Number(row.duration_seconds),
      instruction:String(row.instruction),status:row.status,createdAt:row.created_at,
    }))});
  }catch(error){
    const message=error instanceof Error?error.message:'DIRECTOR_GENERATIVE_REGION_READ_FAILED';
    return NextResponse.json({ok:false,error:message},{status:statusFor(message)});
  }
}

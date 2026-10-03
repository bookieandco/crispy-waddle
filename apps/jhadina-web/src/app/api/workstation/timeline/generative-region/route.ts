import {NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {createServiceRoleClient} from '@/lib/supabase/service-role';
import {requireDirectorProjectAuthority} from '@/lib/director-project-authority';
import {DirectorWorkstationTimelineRepository} from '@/lib/director-workstation-timeline-repository';

const OPERATIONS=new Set(['extend','replace','remove','insert','fill','reframe','retime']);

export async function POST(request:Request){
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
      operation?:string;
      expectedVersion?:number;
    };
    const projectId=body.projectId?.trim()??'';
    const clipId=body.clipId?.trim()??'';
    const instruction=body.instruction?.trim()??'';
    const operation=body.operation?.trim()||'replace';
    if(
      !projectId
      ||!clipId
      ||!instruction
      ||typeof body.startSeconds!=='number'
      ||!Number.isFinite(body.startSeconds)
      ||body.startSeconds<0
      ||typeof body.durationSeconds!=='number'
      ||!Number.isFinite(body.durationSeconds)
      ||body.durationSeconds<=0
      ||!Number.isInteger(body.expectedVersion)
      ||Number(body.expectedVersion)<1
      ||!OPERATIONS.has(operation)
    ){
      return NextResponse.json({
        ok:false,
        error:'projectId, clipId, instruction, operation, startSeconds, durationSeconds and expectedVersion are required',
      },{status:400});
    }

    const privileged=createServiceRoleClient();
    if(!privileged) return NextResponse.json({ok:false,error:'DIRECTOR_PROJECT_STORE_NOT_CONFIGURED'},{status:503});
    await requireDirectorProjectAuthority(privileged,{projectId,userId:user.id,capability:'edit'});

    const timelines=new DirectorWorkstationTimelineRepository(privileged);
    const current=await timelines.ensure(projectId,user.id);
    if(current.version!==body.expectedVersion){
      return NextResponse.json({
        ok:false,
        error:'DIRECTOR_TIMELINE_VERSION_CONFLICT',
        expectedVersion:body.expectedVersion,
        currentVersion:current.version,
        timeline:current.timeline,
      },{status:409});
    }

    const clip=current.timeline.tracks.flatMap(track=>track.clips).find(candidate=>candidate.id===clipId);
    if(!clip) return NextResponse.json({ok:false,error:'DIRECTOR_TIMELINE_CLIP_NOT_FOUND'},{status:404});

    const regionEnd=Number(body.startSeconds)+Number(body.durationSeconds);
    if(regionEnd>current.timeline.durationSeconds+0.0001){
      return NextResponse.json({ok:false,error:'DIRECTOR_GENERATIVE_REGION_OUT_OF_BOUNDS'},{status:400});
    }

    const id=`generative-region:${crypto.randomUUID()}`;
    const now=new Date().toISOString();
    const {data,error}=await privileged.from('director_generative_region_proposals').insert({
      id,
      project_id:projectId,
      user_id:user.id,
      clip_id:clipId,
      start_seconds:body.startSeconds,
      duration_seconds:body.durationSeconds,
      instruction,
      operation,
      status:'pending_approval',
      source_timeline_version:current.version,
      created_at:now,
      updated_at:now,
    }).select('id,project_id,clip_id,start_seconds,duration_seconds,instruction,operation,status,source_timeline_version,result_asset_id,created_at,updated_at').single();
    if(error) throw new Error(`DIRECTOR_GENERATIVE_REGION_WRITE_FAILED:${error.message}`);

    return NextResponse.json({
      ok:true,
      region:{
        id:data.id,
        projectId:data.project_id,
        clipId:data.clip_id,
        startSeconds:Number(data.start_seconds),
        durationSeconds:Number(data.duration_seconds),
        instruction:data.instruction,
        operation:data.operation,
        status:data.status,
        sourceTimelineVersion:Number(data.source_timeline_version),
        resultAssetId:data.result_asset_id??null,
        createdAt:data.created_at,
        updatedAt:data.updated_at,
      },
      requiresApproval:true,
      executionAuthorized:false,
    },{status:202});
  }catch(error){
    const message=error instanceof Error?error.message:'DIRECTOR_GENERATIVE_REGION_CREATE_FAILED';
    const status=message.includes('ACCESS_DENIED')||message.includes('CAPABILITY_DENIED')?403:message.includes('NOT_CONFIGURED')?503:400;
    return NextResponse.json({ok:false,error:message},{status});
  }
}

export async function GET(request:Request){
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
      .select('id,project_id,clip_id,start_seconds,duration_seconds,instruction,operation,status,source_timeline_version,result_asset_id,created_at,updated_at')
      .eq('project_id',projectId)
      .order('created_at',{ascending:false});
    if(error) throw new Error(`DIRECTOR_GENERATIVE_REGION_READ_FAILED:${error.message}`);

    return NextResponse.json({
      ok:true,
      regions:(data??[]).map(row=>({
        id:row.id,
        projectId:row.project_id,
        clipId:row.clip_id,
        startSeconds:Number(row.start_seconds),
        durationSeconds:Number(row.duration_seconds),
        instruction:row.instruction,
        operation:row.operation,
        status:row.status,
        sourceTimelineVersion:Number(row.source_timeline_version),
        resultAssetId:row.result_asset_id??null,
        createdAt:row.created_at,
        updatedAt:row.updated_at,
      })),
    },{headers:{'cache-control':'no-store'}});
  }catch(error){
    const message=error instanceof Error?error.message:'DIRECTOR_GENERATIVE_REGION_READ_FAILED';
    const status=message.includes('ACCESS_DENIED')||message.includes('CAPABILITY_DENIED')?403:message.includes('NOT_CONFIGURED')?503:400;
    return NextResponse.json({ok:false,error:message},{status});
  }
}

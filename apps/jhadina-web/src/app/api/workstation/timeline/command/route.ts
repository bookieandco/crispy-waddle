import {NextResponse} from 'next/server';
import type {SupabaseClient} from '@supabase/supabase-js';
import {applyTimelineCommand,timelineCommandReason,type TimelineCommand} from '@jhadina/director-core/timeline-command';
import type {EditableTimeline,TimelineSnapshot,TimelineVersion} from '@jhadina/director-core/timeline-model';
import {createClient} from '@/lib/supabase/server';
import {createServiceRoleClient} from '@/lib/supabase/service-role';
import {requireDirectorProjectAuthority} from '@/lib/director-project-authority';
import {DirectorWorkstationTimelineRepository} from '@/lib/director-workstation-timeline-repository';

type HistoryCommand=TimelineCommand|{type:'undo';targetVersionId?:string}|{type:'redo';targetVersionId:string};

function snapshot(timeline:EditableTimeline):TimelineSnapshot{
  return {
    tracks:timeline.tracks,
    transitions:timeline.transitions,
    markers:timeline.markers,
    playheadSeconds:timeline.playheadSeconds,
  };
}

function withSnapshot(timeline:EditableTimeline,version:TimelineVersion):EditableTimeline{
  return {...timeline,versions:[...timeline.versions,version]};
}

function baseline(timeline:EditableTimeline,userId:string):EditableTimeline{
  if(timeline.versions.length) return timeline;
  const id=crypto.randomUUID();
  return {
    ...timeline,
    versions:[{
      id,
      version:0,
      createdAt:new Date().toISOString(),
      createdBy:'user',
      message:'Timeline baseline',
      snapshotHash:`${id}:0:${userId}`,
      snapshot:snapshot(timeline),
    }],
  };
}

function restore(timeline:EditableTimeline,targetId:string,kind:'undo'|'redo',userId:string):EditableTimeline{
  const target=timeline.versions.find(version=>version.id===targetId);
  if(!target?.snapshot) throw new Error('DIRECTOR_TIMELINE_HISTORY_SNAPSHOT_MISSING');
  const current=timeline.versions.at(-1);
  const version=(current?.version??0)+1;
  const id=crypto.randomUUID();
  const restored:EditableTimeline={...timeline,...target.snapshot,versions:timeline.versions};
  const entry:TimelineVersion={
    id,
    version,
    parentVersionId:current?.id,
    createdAt:new Date().toISOString(),
    createdBy:'user',
    message:kind==='undo'?'Undo timeline edit':'Redo timeline edit',
    snapshotHash:`${id}:${version}:${userId}`,
    snapshot:target.snapshot,
    ...(kind==='undo'?{revertsVersionId:current?.id}:{restoresVersionId:target.id}),
  };
  return withSnapshot(restored,entry);
}

async function canonicalizeGeneratedAsset(
  command:Extract<TimelineCommand,{type:'insert-generated-asset'}>,
  timeline:EditableTimeline,
  userId:string,
  privileged:SupabaseClient,
):Promise<TimelineCommand>{
  const assetId=command.asset.assetId;
  const approvalId=`approval:${assetId}:${userId}`;
  const [{data:asset,error:assetError},{data:approval,error:approvalError}]=await Promise.all([
    privileged.from('director_generated_editing_assets')
      .select('id,project_id,generation_job_id,media_type,uri,mime_type,metadata')
      .eq('id',assetId)
      .eq('project_id',timeline.projectId)
      .maybeSingle(),
    privileged.from('director_editing_asset_approvals')
      .select('asset_id,approval_id,approved_at,approved_by_user_id')
      .eq('asset_id',assetId)
      .eq('approval_id',approvalId)
      .eq('approved_by_user_id',userId)
      .maybeSingle(),
  ]);
  if(assetError) throw new Error(`DIRECTOR_ASSET_READ_FAILED:${assetError.message}`);
  if(approvalError) throw new Error(`DIRECTOR_ASSET_APPROVAL_READ_FAILED:${approvalError.message}`);
  if(!asset) throw new Error('DIRECTOR_ASSET_NOT_FOUND_FOR_PROJECT');
  if(!approval) throw new Error('DIRECTOR_ASSET_APPROVAL_REQUIRED');
  const metadata=(asset.metadata??{}) as Record<string,unknown>;
  return {
    type:'insert-generated-asset',
    asset:{
      assetId:String(asset.id),
      generationJobId:String(asset.generation_job_id),
      uri:String(asset.uri),
      mimeType:asset.mime_type?String(asset.mime_type):undefined,
      mediaType:asset.media_type,
      operationId:typeof metadata.operationId==='string'?metadata.operationId:undefined,
      sourceId:typeof metadata.sourceId==='string'?metadata.sourceId:command.asset.sourceId,
      startSeconds:command.asset.startSeconds,
      endSeconds:command.asset.endSeconds,
      metadata:{
        ...metadata,
        approvalId:String(approval.approval_id),
        approvedAt:String(approval.approved_at),
      },
    },
  };
}

export async function POST(request:Request){
  try{
    const supabase=await createClient();
    const {data:{user}}=await supabase.auth.getUser();
    if(!user) return NextResponse.json({ok:false,error:'Authentication required'},{status:401});

    const body=await request.json() as {
      projectId?:string;
      expectedVersion?:number;
      command?:HistoryCommand;
    };
    const projectId=body.projectId?.trim()??'';
    if(!projectId||!body.command||!Number.isInteger(body.expectedVersion)||Number(body.expectedVersion)<1){
      return NextResponse.json({
        ok:false,
        error:'projectId, expectedVersion and command are required',
      },{status:400});
    }

    const privileged=createServiceRoleClient();
    if(!privileged) return NextResponse.json({ok:false,error:'DIRECTOR_PROJECT_STORE_NOT_CONFIGURED'},{status:503});
    await requireDirectorProjectAuthority(privileged,{projectId,userId:user.id,capability:'edit'});

    const repository=new DirectorWorkstationTimelineRepository(privileged);
    const canonical=await repository.ensure(projectId,user.id);
    if(canonical.version!==body.expectedVersion){
      return NextResponse.json({
        ok:false,
        error:'DIRECTOR_TIMELINE_VERSION_CONFLICT',
        expectedVersion:body.expectedVersion,
        currentVersion:canonical.version,
        timeline:canonical.timeline,
      },{status:409});
    }

    let timeline=baseline(canonical.timeline,user.id);
    if(body.command.type==='generative-region'||body.command.type==='generate-sfx'){
      return NextResponse.json({
        ok:false,
        status:'approval_required',
        error:'DIRECTOR_GENERATIVE_MUTATION_REQUIRES_DURABLE_APPROVAL',
      },{status:409});
    }

    let operation:string=body.command.type;
    if(body.command.type==='undo'){
      const current=timeline.versions.at(-1);
      const targetId=body.command.targetVersionId??current?.parentVersionId;
      if(!targetId) return NextResponse.json({ok:false,error:'No timeline version available to undo'},{status:409});
      timeline=restore(timeline,targetId,'undo',user.id);
    }else if(body.command.type==='redo'){
      timeline=restore(timeline,body.command.targetVersionId,'redo',user.id);
    }else{
      const command=body.command.type==='insert-generated-asset'
        ?await canonicalizeGeneratedAsset(body.command,timeline,user.id,privileged)
        :body.command;
      const next=applyTimelineCommand(timeline,command);
      const previous=timeline.versions.at(-1);
      const version=(previous?.version??0)+1;
      const versionId=crypto.randomUUID();
      const entry:TimelineVersion={
        id:versionId,
        version,
        parentVersionId:previous?.id,
        createdAt:new Date().toISOString(),
        createdBy:'user',
        message:timelineCommandReason(command),
        snapshotHash:`${versionId}:${version}:${user.id}`,
        snapshot:snapshot(next),
      };
      timeline=withSnapshot(next,entry);
      operation=command.type;
    }

    const saved=await repository.persist({
      projectId,
      userId:user.id,
      expectedVersion:canonical.version,
      timeline,
      evidenceIds:[`DIRECTOR_TIMELINE_COMMAND:${operation}`],
    });

    const timelineVersion=timeline.versions.at(-1);
    return NextResponse.json({
      ok:true,
      status:'completed',
      timeline:saved.timeline,
      snapshotVersion:saved.version,
      audit:{
        event:'director.timeline.mutated',
        projectId,
        operation,
        versionId:timelineVersion?.id??null,
        version:timelineVersion?.version??null,
        snapshotVersion:saved.version,
      },
    });
  }catch(error){
    const message=error instanceof Error?error.message:'Timeline command failed';
    const status=message.includes('ACCESS_DENIED')||message.includes('CAPABILITY_DENIED')||message.includes('EDIT_AUTHORITY')
      ?403
      :message.includes('VERSION_CONFLICT')||message.includes('APPROVAL_REQUIRED')
        ?409
        :message.includes('NOT_FOUND')
          ?404
          :message.includes('NOT_CONFIGURED')
            ?503
            :400;
    return NextResponse.json({ok:false,error:message},{status});
  }
}

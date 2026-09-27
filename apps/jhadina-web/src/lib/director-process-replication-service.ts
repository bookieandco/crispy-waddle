import { randomUUID } from 'node:crypto';
import {
  detectProcessReplicationIntent,
  type ProcessReplicationIntent,
} from '@jhadina/director-core/process-replication';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

export interface DirectorProcessReplicationJob {
  id:string;
  ownerUserId:string;
  clientRequestId:string;
  projectId:string;
  objective:string;
  sourceUrls:readonly string[];
  sourceArtifactRefs:readonly string[];
  studyIds:readonly string[];
  improveBeforeExecute:boolean;
  editableDelivery:true;
  targetDurationSeconds?:number;
  targetKind:ProcessReplicationIntent['targetKind'];
  status:'queued'|'studying'|'recipe_ready'|'executing'|'review'|'completed'|'blocked'|'failed';
  phase:string;
  createdAt:string;
  updatedAt:string;
}

type JobRow={
  id:string;owner_user_id:string;client_request_id:string;project_id:string;objective:string;
  source_urls:string[]|null;source_artifact_refs:string[]|null;study_ids:string[]|null;
  improve_before_execute:boolean;editable_delivery:boolean;target_duration_seconds:number|null;
  target_kind:ProcessReplicationIntent['targetKind'];status:DirectorProcessReplicationJob['status'];phase:string;
  created_at:string;updated_at:string;
};

function toJob(row:JobRow):DirectorProcessReplicationJob{
  return {
    id:row.id,ownerUserId:row.owner_user_id,clientRequestId:row.client_request_id,projectId:row.project_id,
    objective:row.objective,sourceUrls:Object.freeze(row.source_urls??[]),sourceArtifactRefs:Object.freeze(row.source_artifact_refs??[]),
    studyIds:Object.freeze(row.study_ids??[]),improveBeforeExecute:row.improve_before_execute,editableDelivery:true,
    ...(row.target_duration_seconds!==null?{targetDurationSeconds:Number(row.target_duration_seconds)}:{}),
    targetKind:row.target_kind,status:row.status,phase:row.phase,createdAt:row.created_at,updatedAt:row.updated_at,
  };
}

export function inspectAskProcessReplication(
  activeTask:string,
  contextualSourceRefs:readonly string[]=[],
):ProcessReplicationIntent|undefined{
  return detectProcessReplicationIntent(activeTask,contextualSourceRefs);
}

export async function createAskProcessReplicationJob(input:{
  userId:string;
  activeTask:string;
  activeProject?:string;
  clientRequestId?:string;
  sourceArtifactRefs?:readonly string[];
}):Promise<{intent:ProcessReplicationIntent;job:DirectorProcessReplicationJob}>{
  const refs=[...(input.sourceArtifactRefs??[])];
  const intent=detectProcessReplicationIntent(input.activeTask,refs);
  if(!intent) throw new Error('DIRECTOR_PROCESS_REPLICATION_INTENT_NOT_DETECTED');
  const client=createServiceRoleClient();
  if(!client) throw new Error('DIRECTOR_SUPABASE_SERVICE_ROLE_NOT_CONFIGURED');

  const clientRequestId=input.clientRequestId?.trim()||randomUUID();
  const jobId=`replicate:${clientRequestId}`;
  const projectId=input.activeProject?.trim()||`director:replicate:${clientRequestId}`;
  const studyIds=intent.sourceUrls.map((_,index)=>`study:${jobId}:${index}`);
  const now=new Date().toISOString();

  for(let index=0;index<intent.sourceUrls.length;index+=1){
    const studyId=studyIds[index]!;
    const {error}=await client.from('director_studies').upsert({
      id:studyId,source_url:intent.sourceUrls[index]!,autonomous:true,share_with_jhadina:true,status:'queued',
      last_time_seconds:0,observations_seen:0,notes_created:0,learning_candidates_created:0,updated_at:now,
    },{onConflict:'id',ignoreDuplicates:true});
    if(error) throw error;
  }

  const row={
    id:jobId,owner_user_id:input.userId,client_request_id:clientRequestId,project_id:projectId,
    objective:intent.targetPrompt,source_urls:[...intent.sourceUrls],source_artifact_refs:refs,study_ids:studyIds,
    improve_before_execute:intent.improve,editable_delivery:true,target_duration_seconds:intent.targetDurationSeconds??null,
    target_kind:intent.targetKind,status:'queued',phase:'study',updated_at:now,
  };
  const {data,error}=await client.from('director_process_replication_jobs')
    .upsert(row,{onConflict:'owner_user_id,client_request_id'})
    .select('*').single();
  if(error) throw error;
  return {intent,job:toJob(data as JobRow)};
}

export async function getProcessReplicationJobForUser(userId:string,jobId:string):Promise<DirectorProcessReplicationJob|undefined>{
  const client=createServiceRoleClient();
  if(!client) throw new Error('DIRECTOR_SUPABASE_SERVICE_ROLE_NOT_CONFIGURED');
  const {data,error}=await client.from('director_process_replication_jobs').select('*').eq('id',jobId).eq('owner_user_id',userId).maybeSingle();
  if(error) throw error;
  return data?toJob(data as JobRow):undefined;
}

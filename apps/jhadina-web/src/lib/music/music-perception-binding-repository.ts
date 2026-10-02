import {createServiceRoleClient} from '@/lib/supabase/service-role';

type Row=Record<string,unknown>;

export interface MusicPerceptionBinding{
  userId:string;
  projectId:string;
  songId:string;
  caseId:string;
  artifactId:string;
  minimumConfidence:number;
  enabled:boolean;
  lastRuntimeReceiptId?:string;
  lastSyncedAt?:string;
}

export interface MusicPerceptionBindingRepository{
  listEnabled(userId:string,projectId:string):Promise<readonly MusicPerceptionBinding[]>;
  markSynced(input:{userId:string;projectId:string;songId:string;runtimeReceiptId:string}):Promise<void>;
}

export function createMusicPerceptionBindingRepository():MusicPerceptionBindingRepository{
  const client=createServiceRoleClient();
  if(!client)throw new Error('MUSIC_PERCEPTION_BINDING_SERVICE_ROLE_NOT_CONFIGURED');
  return {
    async listEnabled(userId,projectId){
      const {data,error}=await client.from('jhadina_music_perception_bindings').select('*')
        .eq('user_id',userId).eq('project_id',projectId).eq('enabled',true);
      if(error)throw new Error('MUSIC_PERCEPTION_BINDING_READ_FAILED:'+error.message);
      return Object.freeze(((data??[]) as Row[]).map(fromRow));
    },
    async markSynced(input){
      const {error}=await client.from('jhadina_music_perception_bindings').update({
        last_runtime_receipt_id:input.runtimeReceiptId,
        last_synced_at:new Date().toISOString(),
        updated_at:new Date().toISOString(),
      }).eq('user_id',input.userId).eq('project_id',input.projectId).eq('song_id',input.songId);
      if(error)throw new Error('MUSIC_PERCEPTION_BINDING_UPDATE_FAILED:'+error.message);
    },
  };
}

function fromRow(row:Row):MusicPerceptionBinding{
  const confidence=Number(row.minimum_confidence);
  return Object.freeze({
    userId:String(row.user_id),
    projectId:String(row.project_id),
    songId:String(row.song_id),
    caseId:String(row.case_id),
    artifactId:String(row.artifact_id),
    minimumConfidence:Number.isFinite(confidence)?Math.max(0,Math.min(1,confidence)):0.5,
    enabled:row.enabled!==false,
    lastRuntimeReceiptId:text(row.last_runtime_receipt_id),
    lastSyncedAt:text(row.last_synced_at),
  });
}
function text(value:unknown):string|undefined{
  return typeof value==='string'&&value.trim()?value:undefined;
}

import type {SupabaseClient} from '@supabase/supabase-js';
import {runMusicAutopilot,type MusicAutopilotRunReceipt} from './music-autopilot-service';
import {createMusicAutopilotRepository} from './music-autopilot-repository';
import {createMusicPerceptionBindingRepository} from './music-perception-binding-repository';
import {createMusicSocialLineageRepository} from './music-social-lineage-repository';
import {createPrivilegedMusicJuggernautRepository} from './music-privileged-repository';
import {createPrivilegedSocialReadRepository} from './music-privileged-social-read-repository';

type Row=Record<string,unknown>;

export interface MusicAutopilotWorkerReceipt{
  ranAt:string;
  enabledProjects:number;
  processed:number;
  completed:number;
  failed:number;
  receipts:readonly MusicAutopilotRunReceipt[];
  errors:readonly string[];
}

export async function runMusicAutopilotWorker(
  client:SupabaseClient,
  options:{now?:Date;limit?:number}={},
):Promise<MusicAutopilotWorkerReceipt>{
  const now=options.now??new Date();
  const limit=Math.max(1,Math.min(25,Math.floor(options.limit??10)));
  const {data:charters,error}=await client.from('jhadina_music_autopilot_charters')
    .select('user_id,project_id,enabled,updated_at')
    .eq('enabled',true)
    .order('updated_at',{ascending:true})
    .limit(limit);
  if(error)throw new Error('MUSIC_AUTOPILOT_WORKER_CHARTER_SCAN_FAILED:'+error.message);

  const rows=(charters??[]) as Row[];
  const receipts:MusicAutopilotRunReceipt[]=[];
  const errors:string[]=[];
  let completed=0;

  for(const row of rows){
    const userId=String(row.user_id??'').trim();
    const projectId=String(row.project_id??'').trim();
    if(!userId||!projectId){
      errors.push('MUSIC_AUTOPILOT_WORKER_CHARTER_IDENTITY_INVALID');
      continue;
    }
    try{
      const {data:project,error:projectError}=await client.from('jhadina_music_projects')
        .select('id,user_id,artist_key,name')
        .eq('id',projectId).eq('user_id',userId).maybeSingle();
      if(projectError)throw new Error('MUSIC_AUTOPILOT_WORKER_PROJECT_READ_FAILED:'+projectError.message);
      if(!project)throw new Error('MUSIC_AUTOPILOT_WORKER_PROJECT_NOT_FOUND');

      const musicRepository=createPrivilegedMusicJuggernautRepository(client,userId);
      const socialRepository=createPrivilegedSocialReadRepository(client,userId);
      const receipt=await runMusicAutopilot({
        userId,
        artistKey:String(project.artist_key),
        artistName:String(project.name),
        runKey:hourlyRunKey(projectId,now),
        workerId:'music-production-scheduler',
      },{
        client,
        schedulerMode:true,
        musicRepository,
        socialRepository,
        autopilotRepository:createMusicAutopilotRepository(client),
        perceptionBindings:createMusicPerceptionBindingRepository(client),
        lineageRepository:createMusicSocialLineageRepository(client),
        now:()=>now,
      });
      receipts.push(receipt);
      completed+=1;
    }catch(cause){
      errors.push(projectId+':'+errorMessage(cause).slice(0,500));
    }
  }

  return Object.freeze({
    ranAt:now.toISOString(),
    enabledProjects:rows.length,
    processed:rows.length,
    completed,
    failed:errors.length,
    receipts:Object.freeze(receipts),
    errors:Object.freeze(errors),
  });
}

function hourlyRunKey(projectId:string,at:Date):string{
  const hour=at.toISOString().slice(0,13);
  return 'music-auto:scheduler:'+projectId+':'+hour;
}
function errorMessage(error:unknown):string{
  return error instanceof Error?error.message:String(error);
}

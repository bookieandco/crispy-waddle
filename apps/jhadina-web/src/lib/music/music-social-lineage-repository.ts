import type {SupabaseClient} from '@supabase/supabase-js';
import {createServiceRoleClient} from '@/lib/supabase/service-role';

type Row=Record<string,unknown>;

export interface MusicSocialLineage {
  userId:string;
  projectId:string;
  proposalId:string;
  experimentKey:string;
  songId?:string;
  briefId?:string;
  actionKey:string;
  evidenceRefs:readonly string[];
}

export interface MusicSocialLineageRepository {
  bind(input:MusicSocialLineage):Promise<MusicSocialLineage>;
  resolve(userId:string,proposalId:string):Promise<MusicSocialLineage|null>;
}

export function createMusicSocialLineageRepository(clientOverride?:SupabaseClient):MusicSocialLineageRepository{
  const client=clientOverride??createServiceRoleClient();
  if(!client)throw new Error('MUSIC_SOCIAL_LINEAGE_SERVICE_ROLE_NOT_CONFIGURED');
  return {
    async bind(input){
      const {data,error}=await client.from('jhadina_music_social_lineage').upsert({
        user_id:input.userId,
        project_id:input.projectId,
        proposal_id:input.proposalId,
        experiment_key:input.experimentKey,
        song_id:input.songId??null,
        brief_id:input.briefId??null,
        action_key:input.actionKey,
        evidence_refs:[...new Set(input.evidenceRefs)],
      },{onConflict:'user_id,proposal_id'}).select('*').single();
      if(error||!data)throw new Error('MUSIC_SOCIAL_LINEAGE_BIND_FAILED:'+(error?.message??'missing'));
      return fromRow(data as Row);
    },
    async resolve(userId,proposalId){
      const {data,error}=await client.from('jhadina_music_social_lineage').select('*')
        .eq('user_id',userId).eq('proposal_id',proposalId).maybeSingle();
      if(error)throw new Error('MUSIC_SOCIAL_LINEAGE_READ_FAILED:'+error.message);
      return data?fromRow(data as Row):null;
    },
  };
}

function fromRow(row:Row):MusicSocialLineage{
  return Object.freeze({
    userId:String(row.user_id),
    projectId:String(row.project_id),
    proposalId:String(row.proposal_id),
    experimentKey:String(row.experiment_key),
    songId:text(row.song_id),
    briefId:text(row.brief_id),
    actionKey:String(row.action_key),
    evidenceRefs:Object.freeze(Array.isArray(row.evidence_refs)?row.evidence_refs.map(String).filter(Boolean):[]),
  });
}
function text(value:unknown):string|undefined{
  return typeof value==='string'&&value.trim()?value:undefined;
}

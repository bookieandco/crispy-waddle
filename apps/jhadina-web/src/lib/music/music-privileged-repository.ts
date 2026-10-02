import type {SupabaseClient} from '@supabase/supabase-js';
import type {MusicJuggernautRepository} from './music-juggernaut-repository';

type Row=Record<string,unknown>;

export function createPrivilegedMusicJuggernautRepository(
  client:SupabaseClient,
  ownerUserId:string,
):MusicJuggernautRepository{
  const owner=ownerUserId.trim();
  if(!owner)throw new Error('MUSIC_PRIVILEGED_OWNER_REQUIRED');
  return {
    async getProject(userId,artistKey){
      assertOwner(userId,owner);
      const {data,error}=await client.from('jhadina_music_projects').select('*')
        .eq('user_id',owner).eq('artist_key',artistKey).maybeSingle();
      if(error)throw new Error('MUSIC_PRIVILEGED_PROJECT_READ_FAILED:'+error.message);
      return data as Row|null;
    },
    async listSongs(userId,projectId){assertOwner(userId,owner);return list(client,'jhadina_music_song_campaigns',owner,projectId);},
    async listExperiments(userId,projectId){assertOwner(userId,owner);return list(client,'jhadina_music_experiments',owner,projectId);},
    async listObservations(userId,projectId){assertOwner(userId,owner);return list(client,'jhadina_music_observations',owner,projectId,'observed_at');},
    async listCityDemand(userId,projectId){assertOwner(userId,owner);return list(client,'jhadina_music_city_demand',owner,projectId,'show_interest');},
    async listRights(userId,projectId){assertOwner(userId,owner);return list(client,'jhadina_music_rights',owner,projectId);},
    async listLearning(userId,projectId){assertOwner(userId,owner);return list(client,'jhadina_music_learning',owner,projectId,'updated_at');},
    async upsertProject(input){
      const {data,error}=await client.from('jhadina_music_projects').upsert({
        user_id:owner,artist_key:input.artistKey.trim(),name:input.name.trim(),mode:input.mode,
        metadata:input.metadata??{},updated_at:new Date().toISOString(),
      },{onConflict:'user_id,artist_key'}).select('*').single();
      if(error||!data)throw new Error('MUSIC_PRIVILEGED_PROJECT_WRITE_FAILED:'+(error?.message??'missing'));
      return data as Row;
    },
    async upsertSong(input){
      await requireProject(client,owner,input.projectId);
      const {data,error}=await client.from('jhadina_music_song_campaigns').upsert({
        user_id:owner,project_id:input.projectId,song_key:input.songKey.trim(),title:input.title.trim(),
        release_status:input.releaseStatus,campaign_state:input.campaignState,artist_conviction:input.artistConviction,
        rights_state:input.rightsState,sections:input.sections,evidence_refs:input.evidenceRefs,
        release_date:input.releaseDate??null,updated_at:new Date().toISOString(),
      },{onConflict:'user_id,project_id,song_key'}).select('*').single();
      if(error||!data)throw new Error('MUSIC_PRIVILEGED_SONG_WRITE_FAILED:'+(error?.message??'missing'));
      return data as Row;
    },
    async upsertExperiment(input){
      await requireSong(client,owner,input.projectId,input.songId);
      const {data,error}=await client.from('jhadina_music_experiments').upsert({
        user_id:owner,project_id:input.projectId,song_id:input.songId,experiment_key:input.experimentKey.trim(),
        section_key:input.sectionKey??null,hypothesis:input.hypothesis.trim(),content_family:input.contentFamily.trim(),
        platform:input.platform.trim(),audience:input.audience??null,spend_minor:input.spendMinor,currency:input.currency,
        sample_target:input.sampleTarget,success_signal:input.successSignal.trim(),failure_signal:input.failureSignal.trim(),
        status:input.status,evidence_refs:input.evidenceRefs,updated_at:new Date().toISOString(),
      },{onConflict:'user_id,project_id,experiment_key'}).select('*').single();
      if(error||!data)throw new Error('MUSIC_PRIVILEGED_EXPERIMENT_WRITE_FAILED:'+(error?.message??'missing'));
      return data as Row;
    },
    async recordObservation(input){
      await requireExperiment(client,owner,input.projectId,input.experimentId);
      const m=input.metrics;
      const {data,error}=await client.from('jhadina_music_observations').upsert({
        user_id:owner,project_id:input.projectId,experiment_id:input.experimentId,
        observation_key:input.observationKey.trim(),exposures:num(m.exposures),views:num(m.views),
        engaged_views:nullable(m.engagedViews),shares:num(m.shares),saves:num(m.saves),comments:num(m.comments),
        profile_visits:num(m.profileVisits),song_actions:num(m.songActions),direct_fan_captures:num(m.directFanCaptures),
        purchases:nullable(m.purchases),revenue_minor:nullable(m.revenueMinor),bot_risk:input.botRisk,
        attribution_confidence:input.attributionConfidence,observed_at:input.observedAt,evidence_refs:input.evidenceRefs,
      },{onConflict:'user_id,project_id,observation_key'}).select('*').single();
      if(error||!data)throw new Error('MUSIC_PRIVILEGED_OBSERVATION_WRITE_FAILED:'+(error?.message??'missing'));
      return data as Row;
    },
    async upsertCityDemand(input){
      await requireProject(client,owner,input.projectId);
      const {data,error}=await client.from('jhadina_music_city_demand').upsert({
        user_id:owner,project_id:input.projectId,city_key:input.cityKey.trim(),city_name:input.cityName.trim(),
        listeners:input.listeners,direct_fans:input.directFans,show_interest:input.showInterest,
        prior_attendees:input.priorAttendees,repeat_fans:input.repeatFans,evidence_refs:input.evidenceRefs,
        observed_at:input.observedAt,updated_at:new Date().toISOString(),
      },{onConflict:'user_id,project_id,city_key'}).select('*').single();
      if(error||!data)throw new Error('MUSIC_PRIVILEGED_CITY_WRITE_FAILED:'+(error?.message??'missing'));
      return data as Row;
    },
    async upsertRights(input){
      await requireProject(client,owner,input.projectId);
      const {data,error}=await client.from('jhadina_music_rights').upsert({
        user_id:owner,project_id:input.projectId,asset_key:input.assetKey.trim(),
        master_ownership_known:input.masterOwnershipKnown,publishing_known:input.publishingKnown,
        sample_status:input.sampleStatus,third_party_usage_status:input.thirdPartyUsageStatus,
        evidence_refs:input.evidenceRefs,updated_at:new Date().toISOString(),
      },{onConflict:'user_id,project_id,asset_key'}).select('*').single();
      if(error||!data)throw new Error('MUSIC_PRIVILEGED_RIGHTS_WRITE_FAILED:'+(error?.message??'missing'));
      return data as Row;
    },
    async upsertLearning(input){
      await requireProject(client,owner,input.projectId);
      const {data,error}=await client.from('jhadina_music_learning').upsert({
        user_id:owner,project_id:input.projectId,learning_key:input.learningKey.trim(),status:input.status,
        confidence:input.confidence,finding:input.finding.trim(),reusable_signals:input.reusableSignals,
        evidence_refs:input.evidenceRefs,updated_at:new Date().toISOString(),
      },{onConflict:'user_id,project_id,learning_key'}).select('*').single();
      if(error||!data)throw new Error('MUSIC_PRIVILEGED_LEARNING_WRITE_FAILED:'+(error?.message??'missing'));
      return data as Row;
    },
  };
}

async function list(client:SupabaseClient,table:string,userId:string,projectId:string,order='created_at'):Promise<Row[]>{
  const {data,error}=await client.from(table).select('*').eq('user_id',userId).eq('project_id',projectId).order(order,{ascending:false});
  if(error)throw new Error('MUSIC_PRIVILEGED_LIST_FAILED:'+table+':'+error.message);
  return (data??[]) as Row[];
}
async function requireProject(client:SupabaseClient,userId:string,projectId:string):Promise<void>{
  const {data,error}=await client.from('jhadina_music_projects').select('id').eq('id',projectId).eq('user_id',userId).maybeSingle();
  if(error)throw error;if(!data)throw new Error('MUSIC_PRIVILEGED_PROJECT_NOT_FOUND');
}
async function requireSong(client:SupabaseClient,userId:string,projectId:string,songId:string):Promise<void>{
  const {data,error}=await client.from('jhadina_music_song_campaigns').select('id').eq('id',songId).eq('project_id',projectId).eq('user_id',userId).maybeSingle();
  if(error)throw error;if(!data)throw new Error('MUSIC_PRIVILEGED_SONG_NOT_FOUND');
}
async function requireExperiment(client:SupabaseClient,userId:string,projectId:string,experimentId:string):Promise<void>{
  const {data,error}=await client.from('jhadina_music_experiments').select('id').eq('id',experimentId).eq('project_id',projectId).eq('user_id',userId).maybeSingle();
  if(error)throw error;if(!data)throw new Error('MUSIC_PRIVILEGED_EXPERIMENT_NOT_FOUND');
}
function assertOwner(value:string,owner:string):void{if(value!==owner)throw new Error('MUSIC_PRIVILEGED_OWNER_MISMATCH');}
function num(value:unknown):number{const n=Number(value);return Number.isFinite(n)&&n>=0?n:0;}
function nullable(value:unknown):number|null{if(value===null||value===undefined)return null;return num(value);}

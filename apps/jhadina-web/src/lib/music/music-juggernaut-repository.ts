import { createClient } from '../supabase/server';

type Row=Record<string,unknown>;

export interface MusicJuggernautRepository {
  getProject(userId:string,artistKey:string):Promise<Row|null>;
  listSongs(userId:string,projectId:string):Promise<Row[]>;
  listExperiments(userId:string,projectId:string):Promise<Row[]>;
  listObservations(userId:string,projectId:string):Promise<Row[]>;
  listCityDemand(userId:string,projectId:string):Promise<Row[]>;
  listRights(userId:string,projectId:string):Promise<Row[]>;
  listLearning(userId:string,projectId:string):Promise<Row[]>;
  upsertProject(input:{artistKey:string;name:string;mode:'SEARCH'|'ATTACK';metadata?:Row}):Promise<Row>;
  upsertSong(input:{projectId:string;songKey:string;title:string;releaseStatus:string;campaignState:string;artistConviction:number;rightsState:string;sections:unknown[];evidenceRefs:string[];releaseDate?:string}):Promise<Row>;
  upsertExperiment(input:{projectId:string;songId:string;experimentKey:string;sectionKey?:string;hypothesis:string;contentFamily:string;platform:string;audience?:string;spendMinor:number;currency:string;sampleTarget:number;successSignal:string;failureSignal:string;status:string;evidenceRefs:string[]}):Promise<Row>;
  recordObservation(input:{projectId:string;experimentId:string;observationKey:string;observedAt:string;metrics:Row;botRisk:number;attributionConfidence:number;evidenceRefs:string[]}):Promise<Row>;
  upsertCityDemand(input:{projectId:string;cityKey:string;cityName:string;listeners:number;directFans:number;showInterest:number;priorAttendees:number;repeatFans:number;evidenceRefs:string[];observedAt:string}):Promise<Row>;
  upsertRights(input:{projectId:string;assetKey:string;masterOwnershipKnown:boolean;publishingKnown:boolean;sampleStatus:string;thirdPartyUsageStatus:string;evidenceRefs:string[]}):Promise<Row>;
  upsertLearning(input:{projectId:string;learningKey:string;status:'provisional'|'validated'|'rejected';confidence:number;finding:string;reusableSignals:Row;evidenceRefs:string[]}):Promise<Row>;
}

export function createMusicJuggernautRepository():MusicJuggernautRepository{
  return {
    async getProject(userId,artistKey){
      const db=await createClient();
      const {data,error}=await db.from('jhadina_music_projects').select('*').eq('user_id',userId).eq('artist_key',artistKey).maybeSingle();
      if(error)throw new Error('MUSIC_JUGGERNAUT_PROJECT_READ_FAILED:'+error.message);
      return data as Row|null;
    },
    async listSongs(userId,projectId){return listRows('jhadina_music_song_campaigns',userId,projectId);},
    async listExperiments(userId,projectId){return listRows('jhadina_music_experiments',userId,projectId);},
    async listObservations(userId,projectId){return listRows('jhadina_music_observations',userId,projectId,'observed_at');},
    async listCityDemand(userId,projectId){return listRows('jhadina_music_city_demand',userId,projectId,'show_interest');},
    async listRights(userId,projectId){return listRows('jhadina_music_rights',userId,projectId);},
    async listLearning(userId,projectId){return listRows('jhadina_music_learning',userId,projectId,'updated_at');},
    async upsertProject(input){
      return rpcOne('jhadina_music_upsert_project',{p_artist_key:input.artistKey,p_name:input.name,p_mode:input.mode,p_metadata:input.metadata??{}});
    },
    async upsertSong(input){
      return rpcOne('jhadina_music_upsert_song',{
        p_project_id:input.projectId,p_song_key:input.songKey,p_title:input.title,p_release_status:input.releaseStatus,
        p_campaign_state:input.campaignState,p_artist_conviction:input.artistConviction,p_rights_state:input.rightsState,
        p_sections:input.sections,p_evidence_refs:input.evidenceRefs,p_release_date:input.releaseDate??null,
      });
    },
    async upsertExperiment(input){
      return rpcOne('jhadina_music_upsert_experiment',{
        p_project_id:input.projectId,p_song_id:input.songId,p_experiment_key:input.experimentKey,p_section_key:input.sectionKey??null,
        p_hypothesis:input.hypothesis,p_content_family:input.contentFamily,p_platform:input.platform,p_audience:input.audience??null,
        p_spend_minor:input.spendMinor,p_currency:input.currency,p_sample_target:input.sampleTarget,p_success_signal:input.successSignal,
        p_failure_signal:input.failureSignal,p_status:input.status,p_evidence_refs:input.evidenceRefs,
      });
    },
    async recordObservation(input){
      return rpcOne('jhadina_music_record_observation',{
        p_project_id:input.projectId,p_experiment_id:input.experimentId,p_observation_key:input.observationKey,p_observed_at:input.observedAt,
        p_metrics:input.metrics,p_bot_risk:input.botRisk,p_attribution_confidence:input.attributionConfidence,p_evidence_refs:input.evidenceRefs,
      });
    },
    async upsertCityDemand(input){
      return rpcOne('jhadina_music_upsert_city_demand',{
        p_project_id:input.projectId,p_city_key:input.cityKey,p_city_name:input.cityName,p_listeners:input.listeners,p_direct_fans:input.directFans,
        p_show_interest:input.showInterest,p_prior_attendees:input.priorAttendees,p_repeat_fans:input.repeatFans,p_evidence_refs:input.evidenceRefs,
        p_observed_at:input.observedAt,
      });
    },
    async upsertRights(input){
      return rpcOne('jhadina_music_upsert_rights',{
        p_project_id:input.projectId,p_asset_key:input.assetKey,p_master_ownership_known:input.masterOwnershipKnown,p_publishing_known:input.publishingKnown,
        p_sample_status:input.sampleStatus,p_third_party_usage_status:input.thirdPartyUsageStatus,p_evidence_refs:input.evidenceRefs,
      });
    },
    async upsertLearning(input){
      return rpcOne('jhadina_music_upsert_learning',{
        p_project_id:input.projectId,p_learning_key:input.learningKey,p_status:input.status,p_confidence:input.confidence,
        p_finding:input.finding,p_reusable_signals:input.reusableSignals,p_evidence_refs:input.evidenceRefs,
      });
    },
  };
}

async function listRows(table:string,userId:string,projectId:string,orderColumn='created_at'):Promise<Row[]>{
  const db=await createClient();
  const {data,error}=await db.from(table).select('*').eq('user_id',userId).eq('project_id',projectId).order(orderColumn,{ascending:false});
  if(error)throw new Error('MUSIC_JUGGERNAUT_LIST_FAILED:'+table+':'+error.message);
  return (data??[]) as Row[];
}

async function rpcOne(name:string,args:Row):Promise<Row>{
  const db=await createClient();
  const {data,error}=await db.rpc(name,args).single();
  if(error||!data)throw new Error('MUSIC_JUGGERNAUT_WRITE_FAILED:'+name+':'+(error?.message??'no row'));
  return data as Row;
}

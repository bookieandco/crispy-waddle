import type {
  BreakoutWindow,
  CityDemand,
  ContentExperiment,
  FanRecord,
  JuggernautSnapshot,
  PerformanceObservation,
  PromotionBudget,
  SongRecord,
} from '@jhadina/growth-core';
import { createClient } from '../supabase/server';

export interface JuggernautRepository {
  getSnapshot(userId:string,artistId:string,budget?:PromotionBudget):Promise<JuggernautSnapshot>;
  upsertSong(userId:string,song:SongRecord):Promise<void>;
  upsertExperiment(userId:string,experiment:ContentExperiment):Promise<void>;
  recordObservation(userId:string,observation:PerformanceObservation,idempotencyKey:string):Promise<'recorded'|'duplicate'>;
  upsertFan(userId:string,fan:FanRecord):Promise<void>;
  upsertCityDemand(userId:string,demand:CityDemand):Promise<void>;
  upsertBreakout(userId:string,breakout:BreakoutWindow):Promise<void>;
  appendEvent(userId:string,input:{eventKey:string;eventType:string;entityType:string;entityId:string;payload:Record<string,unknown>;occurredAt:string;correlationId:string;evidenceRefs:readonly string[]}):Promise<'recorded'|'duplicate'>;
}

type JsonRow={payload:unknown};
type SongRow={
  id:string;title:string;status:SongRecord['status'];artist_conviction:number;rights_state:SongRecord['rightsState'];
  sections:SongRecord['sections'];release_date:string|null;evidence_refs:string[];
};

export function createJuggernautRepository():JuggernautRepository{
  return {
    async getSnapshot(userId,artistId,budget=emptyBudget()){
      const supabase=await createClient();
      const [songsResult,experimentsResult,observationsResult,fansResult,citiesResult,breakoutsResult]=await Promise.all([
        supabase.from('jhadina_music_juggernaut_songs').select('*').eq('user_id',userId).order('updated_at',{ascending:false}),
        supabase.from('jhadina_music_juggernaut_experiments').select('payload').eq('user_id',userId).order('updated_at',{ascending:false}),
        supabase.from('jhadina_music_juggernaut_observations').select('payload').eq('user_id',userId).order('observed_at',{ascending:false}).limit(1000),
        supabase.from('jhadina_music_juggernaut_fans').select('payload').eq('user_id',userId).order('updated_at',{ascending:false}).limit(5000),
        supabase.from('jhadina_music_juggernaut_city_demand').select('payload').eq('user_id',userId).order('updated_at',{ascending:false}),
        supabase.from('jhadina_music_juggernaut_breakouts').select('payload').eq('user_id',userId).eq('state','OPEN').order('updated_at',{ascending:false}).limit(1),
      ]);
      for(const result of [songsResult,experimentsResult,observationsResult,fansResult,citiesResult,breakoutsResult]){
        if(result.error)throw new Error('MUSIC_JUGGERNAUT_READ_FAILED:'+result.error.message);
      }
      const songs=((songsResult.data??[]) as SongRow[]).map(songFromRow);
      const experiments=((experimentsResult.data??[]) as JsonRow[]).map((row)=>row.payload as ContentExperiment);
      const observations=((observationsResult.data??[]) as JsonRow[]).map((row)=>row.payload as PerformanceObservation);
      const fans=((fansResult.data??[]) as JsonRow[]).map((row)=>row.payload as FanRecord);
      const cityDemand=((citiesResult.data??[]) as JsonRow[]).map((row)=>row.payload as CityDemand);
      const breakout=((breakoutsResult.data??[]) as JsonRow[])[0]?.payload as BreakoutWindow|undefined;
      return {
        artistId,
        mode:breakout?'ATTACK':'SEARCH',
        songs:Object.freeze(songs),
        experiments:Object.freeze(experiments),
        observations:Object.freeze(observations),
        fans:Object.freeze(fans),
        cityDemand:Object.freeze(cityDemand),
        budget,
        breakout,
      };
    },

    async upsertSong(userId,song){
      const supabase=await createClient();
      const {error}=await supabase.from('jhadina_music_juggernaut_songs').upsert({
        user_id:userId,id:song.id,title:song.title,status:song.status,artist_conviction:song.artistConviction,
        rights_state:song.rightsState,sections:song.sections,release_date:song.releaseDate??null,
        evidence_refs:[...song.evidenceRefs],updated_at:new Date().toISOString(),
      },{onConflict:'user_id,id'});
      if(error)throw new Error('MUSIC_JUGGERNAUT_SONG_WRITE_FAILED:'+error.message);
    },

    async upsertExperiment(userId,experiment){
      const supabase=await createClient();
      const {error}=await supabase.from('jhadina_music_juggernaut_experiments').upsert({
        user_id:userId,id:experiment.id,song_id:experiment.songId,payload:experiment,status:experiment.status,updated_at:new Date().toISOString(),
      },{onConflict:'user_id,id'});
      if(error)throw new Error('MUSIC_JUGGERNAUT_EXPERIMENT_WRITE_FAILED:'+error.message);
    },

    async recordObservation(userId,observation,idempotencyKey){
      const supabase=await createClient();
      const {error}=await supabase.from('jhadina_music_juggernaut_observations').insert({
        user_id:userId,id:observation.id,experiment_id:observation.experimentId,observed_at:observation.observedAt,
        payload:observation,idempotency_key:idempotencyKey,
      });
      if(!error)return 'recorded';
      if(error.code==='23505')return 'duplicate';
      throw new Error('MUSIC_JUGGERNAUT_OBSERVATION_WRITE_FAILED:'+error.message);
    },

    async upsertFan(userId,fan){
      const supabase=await createClient();
      const {error}=await supabase.from('jhadina_music_juggernaut_fans').upsert({
        user_id:userId,id:fan.id,stage:fan.stage,payload:fan,updated_at:new Date().toISOString(),
      },{onConflict:'user_id,id'});
      if(error)throw new Error('MUSIC_JUGGERNAUT_FAN_WRITE_FAILED:'+error.message);
    },

    async upsertCityDemand(userId,demand){
      const supabase=await createClient();
      const {error}=await supabase.from('jhadina_music_juggernaut_city_demand').upsert({
        user_id:userId,city:demand.city,payload:demand,updated_at:new Date().toISOString(),
      },{onConflict:'user_id,city'});
      if(error)throw new Error('MUSIC_JUGGERNAUT_CITY_WRITE_FAILED:'+error.message);
    },

    async upsertBreakout(userId,breakout){
      const supabase=await createClient();
      const {error}=await supabase.from('jhadina_music_juggernaut_breakouts').upsert({
        user_id:userId,song_id:breakout.songId,payload:breakout,state:breakout.state,updated_at:new Date().toISOString(),
      },{onConflict:'user_id,song_id'});
      if(error)throw new Error('MUSIC_JUGGERNAUT_BREAKOUT_WRITE_FAILED:'+error.message);
    },

    async appendEvent(userId,input){
      const supabase=await createClient();
      const {error}=await supabase.from('jhadina_music_juggernaut_events').insert({
        user_id:userId,event_key:input.eventKey,event_type:input.eventType,entity_type:input.entityType,entity_id:input.entityId,
        payload:input.payload,occurred_at:input.occurredAt,correlation_id:input.correlationId,evidence_refs:[...input.evidenceRefs],
      });
      if(!error)return 'recorded';
      if(error.code==='23505')return 'duplicate';
      throw new Error('MUSIC_JUGGERNAUT_EVENT_WRITE_FAILED:'+error.message);
    },
  };
}

function songFromRow(row:SongRow):SongRecord{
  return {
    id:row.id,title:row.title,status:row.status,artistConviction:Number(row.artist_conviction),sections:row.sections,
    rightsState:row.rights_state,releaseDate:row.release_date??undefined,evidenceRefs:Object.freeze(row.evidence_refs??[]),
  };
}
function emptyBudget():PromotionBudget{
  return {approvedMinor:0,spentMinor:0,experimentReserveMinor:0,breakoutReserveMinor:0,productionReserveMinor:0,currency:'USD'};
}

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Observation } from '@jhadina/director-core/observation-bus';

type ObservationRow = {
  id:string;
  study_id:string;
  asset_id:string;
  kind:string;
  start_seconds:number;
  end_seconds:number;
  payload:unknown;
  confidence:number;
  provenance:Record<string,unknown>;
};

function toObservation(row:ObservationRow):Observation {
  return {
    id:row.id,
    assetId:row.asset_id,
    kind:row.kind,
    time:{startSeconds:Number(row.start_seconds),endSeconds:Number(row.end_seconds)},
    payload:row.payload,
    confidence:Number(row.confidence),
    provenance:row.provenance as Observation['provenance'],
  };
}

export function createSupabaseStudyObservationStore(client:SupabaseClient){
  return {
    async save(studyId:string, observations:readonly Observation[]):Promise<void>{
      if(!observations.length) return;
      for(const observation of observations){
        if(observation.assetId!==studyId) throw new Error('DIRECTOR_STUDY_OBSERVATION_ASSET_MISMATCH');
        if(!Number.isFinite(observation.confidence)||observation.confidence<0||observation.confidence>1){
          throw new Error('DIRECTOR_STUDY_OBSERVATION_CONFIDENCE_INVALID');
        }
        if(!Number.isFinite(observation.time.startSeconds)||!Number.isFinite(observation.time.endSeconds)||observation.time.endSeconds<observation.time.startSeconds){
          throw new Error('DIRECTOR_STUDY_OBSERVATION_TIME_INVALID');
        }
      }
      const {error}=await client.from('director_study_observations').upsert(
        observations.map(observation=>({
          id:observation.id,
          study_id:studyId,
          asset_id:observation.assetId,
          kind:observation.kind,
          start_seconds:observation.time.startSeconds,
          end_seconds:observation.time.endSeconds,
          payload:observation.payload,
          confidence:observation.confidence,
          provenance:observation.provenance,
        })),
        {onConflict:'id'},
      );
      if(error) throw error;
    },
    async list(studyIds:readonly string[]):Promise<Observation[]>{
      if(!studyIds.length) return [];
      const {data,error}=await client.from('director_study_observations')
        .select('id,study_id,asset_id,kind,start_seconds,end_seconds,payload,confidence,provenance')
        .in('study_id',[...studyIds])
        .order('start_seconds',{ascending:true})
        .order('id',{ascending:true});
      if(error) throw error;
      return (data??[]).map(row=>toObservation(row as ObservationRow));
    },
  };
}

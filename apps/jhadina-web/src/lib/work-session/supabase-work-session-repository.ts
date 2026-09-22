import type { SupabaseClient } from '@supabase/supabase-js';
import type { JhadinaWorkSession, WorkSessionRepository } from '@jhadina/core-spine';

type WorkSessionRow={
  id:string; owner_user_id:string; goal:string; status:JhadinaWorkSession['status'];
  active_subsystems:unknown; artifact_refs:unknown; decision_refs:unknown; output_refs:unknown;
  created_at:string; updated_at:string;
};

export class SupabaseWorkSessionRepository implements WorkSessionRepository {
  constructor(private readonly client:SupabaseClient,private readonly ownerUserId:string){}

  async get(id:string):Promise<JhadinaWorkSession|null>{
    const {data,error}=await this.client.from('jhadina_work_sessions').select('*').eq('id',id).eq('owner_user_id',this.ownerUserId).maybeSingle();
    if(error)throw new Error(`WORK_SESSION_READ_FAILED:${error.message}`);
    return data?fromRow(data as WorkSessionRow):null;
  }

  async save(session:JhadinaWorkSession):Promise<void>{
    if(session.ownerUserId!==this.ownerUserId)throw new Error('WORK_SESSION_OWNER_MISMATCH');
    const {error}=await this.client.from('jhadina_work_sessions').upsert({
      id:session.id,owner_user_id:session.ownerUserId,goal:session.goal,status:session.status,
      active_subsystems:session.activeSubsystems,artifact_refs:session.artifactRefs,
      decision_refs:session.decisionRefs,output_refs:session.outputRefs,
      created_at:session.createdAt,updated_at:session.updatedAt,
    },{onConflict:'id'});
    if(error)throw new Error(`WORK_SESSION_WRITE_FAILED:${error.message}`);
  }
}

function fromRow(row:WorkSessionRow):JhadinaWorkSession{
  return Object.freeze({
    id:row.id,ownerUserId:row.owner_user_id,goal:row.goal,status:row.status,
    activeSubsystems:Object.freeze(asArray<string>(row.active_subsystems)),
    artifactRefs:Object.freeze(asArray<JhadinaWorkSession['artifactRefs'][number]>(row.artifact_refs)),
    decisionRefs:Object.freeze(asArray<string>(row.decision_refs)),
    outputRefs:Object.freeze(asArray<string>(row.output_refs)),
    createdAt:row.created_at,updatedAt:row.updated_at,
  });
}
function asArray<T>(value:unknown):T[]{return Array.isArray(value)?value as T[]:[];}

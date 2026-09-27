import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CapabilityRuntimeEvidence,
  CapabilityRuntimeState,
  CapabilityRuntimeStatus,
  CapabilityRuntimeStatusRepository,
} from '@jhadina/capability-registry';

type CapabilityStatusRow={
  capability_name:string;
  subsystem_id:string|null;
  state:CapabilityRuntimeState;
  reason:string|null;
  evidence:unknown;
  updated_at:string;
};

export class SupabaseCapabilityRuntimeStatusRepository implements CapabilityRuntimeStatusRepository {
  constructor(private readonly client:SupabaseClient){}

  async get(capabilityName:string):Promise<CapabilityRuntimeStatus|undefined>{
    const {data,error}=await this.client.from('jhadina_capability_runtime_status')
      .select('*').eq('capability_name',capabilityName).maybeSingle();
    if(error)throw new Error(`CAPABILITY_RUNTIME_STATUS_READ_FAILED:${error.message}`);
    return data?fromRow(data as CapabilityStatusRow):undefined;
  }

  async list():Promise<readonly CapabilityRuntimeStatus[]>{
    const {data,error}=await this.client.from('jhadina_capability_runtime_status')
      .select('*').order('capability_name',{ascending:true});
    if(error)throw new Error(`CAPABILITY_RUNTIME_STATUS_LIST_FAILED:${error.message}`);
    return Object.freeze(((data??[]) as CapabilityStatusRow[]).map(fromRow));
  }

  async save(status:CapabilityRuntimeStatus):Promise<void>{
    const {error}=await this.client.from('jhadina_capability_runtime_status').upsert({
      capability_name:status.capabilityName,
      subsystem_id:status.subsystemId??null,
      state:status.state,
      reason:status.reason??null,
      evidence:status.evidence,
      updated_at:status.updatedAt,
    },{onConflict:'capability_name'});
    if(error)throw new Error(`CAPABILITY_RUNTIME_STATUS_WRITE_FAILED:${error.message}`);
  }
}

function fromRow(row:CapabilityStatusRow):CapabilityRuntimeStatus{
  return Object.freeze({
    capabilityName:row.capability_name,
    subsystemId:row.subsystem_id??undefined,
    state:row.state,
    reason:row.reason??undefined,
    evidence:Object.freeze(asEvidence(row.evidence)),
    updatedAt:row.updated_at,
  });
}

function asEvidence(value:unknown):CapabilityRuntimeEvidence[]{
  if(!Array.isArray(value))return [];
  return value.filter((item):item is CapabilityRuntimeEvidence=>{
    if(!item||typeof item!=='object')return false;
    const record=item as Record<string,unknown>;
    return typeof record.id==='string'&&typeof record.source==='string'&&typeof record.observedAt==='string'&&
      (record.kind==='source'||record.kind==='infrastructure'||record.kind==='live-runtime'||record.kind==='operator')&&
      typeof record.summary==='string'&&(record.expiresAt===undefined||typeof record.expiresAt==='string');
  }).map(item=>Object.freeze({...item}));
}

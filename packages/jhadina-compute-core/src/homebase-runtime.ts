export type HomebaseRuntimeMode='HOMEBASE_PRIMARY'|'PORTABLE_STAGING';

export type HomebaseRuntimeContract={
  schema:'jhadina.homebase-runtime.v1';
  homebaseId:string;
  mode:HomebaseRuntimeMode;
  canonicalAuthority:'HOMEBASE';
  canonicalDatabase:'POSTGRES';
  canonicalObjectStorage:'S3_COMPATIBLE';
  canonicalQueue:'NATS_JETSTREAM';
  cache:'VALKEY';
  backupRequired:true;
  cloudPolicy:{
    runpodRole:'RESEARCH_AND_BURST_ONLY';
    mayOwnCanonicalState:false;
    mayGrantDomainAuthority:false;
    sensitiveDataAllowed:false;
  };
  offlinePolicy:{
    canonicalServicesRemainLocal:true;
    cloudJobsMayDefer:true;
  };
};

export function validateHomebaseRuntimeContract(c:HomebaseRuntimeContract):readonly string[]{
  const r:string[]=[];
  if(!c.homebaseId.trim())r.push('HOMEBASE_ID_REQUIRED');
  if(c.canonicalAuthority!=='HOMEBASE')r.push('HOMEBASE_CANONICAL_AUTHORITY_REQUIRED');
  if(c.canonicalDatabase!=='POSTGRES')r.push('HOMEBASE_POSTGRES_REQUIRED');
  if(c.canonicalObjectStorage!=='S3_COMPATIBLE')r.push('HOMEBASE_OBJECT_STORAGE_REQUIRED');
  if(c.canonicalQueue!=='NATS_JETSTREAM')r.push('HOMEBASE_DURABLE_QUEUE_REQUIRED');
  if(c.cache!=='VALKEY')r.push('HOMEBASE_CACHE_CONTRACT_REQUIRED');
  if(c.backupRequired!==true)r.push('HOMEBASE_BACKUP_REQUIRED');
  if(c.cloudPolicy.runpodRole!=='RESEARCH_AND_BURST_ONLY')r.push('RUNPOD_ROLE_INVALID');
  if(c.cloudPolicy.mayOwnCanonicalState!==false)r.push('RUNPOD_CANONICAL_STATE_FORBIDDEN');
  if(c.cloudPolicy.mayGrantDomainAuthority!==false)r.push('RUNPOD_DOMAIN_AUTHORITY_FORBIDDEN');
  if(c.cloudPolicy.sensitiveDataAllowed!==false)r.push('RUNPOD_SENSITIVE_DATA_FORBIDDEN');
  if(c.offlinePolicy.canonicalServicesRemainLocal!==true)r.push('HOMEBASE_OFFLINE_LOCAL_AUTHORITY_REQUIRED');
  return Object.freeze([...new Set(r)]);
}

export function createHomebaseRuntimeContract(homebaseId:string,mode:HomebaseRuntimeMode='HOMEBASE_PRIMARY'):HomebaseRuntimeContract{
  return Object.freeze({
    schema:'jhadina.homebase-runtime.v1',
    homebaseId,
    mode,
    canonicalAuthority:'HOMEBASE',
    canonicalDatabase:'POSTGRES',
    canonicalObjectStorage:'S3_COMPATIBLE',
    canonicalQueue:'NATS_JETSTREAM',
    cache:'VALKEY',
    backupRequired:true,
    cloudPolicy:{
      runpodRole:'RESEARCH_AND_BURST_ONLY',
      mayOwnCanonicalState:false,
      mayGrantDomainAuthority:false,
      sensitiveDataAllowed:false,
    },
    offlinePolicy:{canonicalServicesRemainLocal:true,cloudJobsMayDefer:true},
  });
}

export type HomebaseOfflineState={
  internetAvailable:boolean;
  canonicalDatabaseReady:boolean;
  objectStorageReady:boolean;
  queueReady:boolean;
};

export type HomebaseOfflinePlan={
  mode:'ONLINE'|'LOCAL_ONLY'|'READ_ONLY_SAFE'|'STOPPED';
  acceptLocalJobs:boolean;
  acceptCloudJobs:boolean;
  canonicalWrites:boolean;
  reason:string;
};

export function planHomebaseOfflineMode(s:HomebaseOfflineState):HomebaseOfflinePlan{
  const canonical=s.canonicalDatabaseReady&&s.objectStorageReady&&s.queueReady;
  if(canonical&&s.internetAvailable){
    return {mode:'ONLINE',acceptLocalJobs:true,acceptCloudJobs:true,canonicalWrites:true,reason:'ALL_CORE_SERVICES_READY'};
  }
  if(canonical){
    return {mode:'LOCAL_ONLY',acceptLocalJobs:true,acceptCloudJobs:false,canonicalWrites:true,reason:'INTERNET_UNAVAILABLE'};
  }
  if(s.canonicalDatabaseReady){
    return {mode:'READ_ONLY_SAFE',acceptLocalJobs:false,acceptCloudJobs:false,canonicalWrites:false,reason:'DURABLE_DEPENDENCY_DEGRADED'};
  }
  return {mode:'STOPPED',acceptLocalJobs:false,acceptCloudJobs:false,canonicalWrites:false,reason:'CANONICAL_DATABASE_UNAVAILABLE'};
}

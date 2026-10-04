import {validateHomebaseRuntimeContract,type HomebaseRuntimeContract} from './homebase-runtime.js';
import {validateHomebaseStorage,type HomebaseStorageContract} from './homebase-storage.js';
import {validateWorkerFleet,type HomebaseWorkerProfile} from './homebase-worker-fleet.js';
import {validateHomebaseSubsystemMigrations,type HomebaseSubsystemMigration} from './homebase-subsystem-migration.js';

export type HomebaseFinalEvidence={
  runtime:HomebaseRuntimeContract;
  storage:HomebaseStorageContract;
  workers:readonly HomebaseWorkerProfile[];
  subsystems:readonly HomebaseSubsystemMigration[];
  serviceRegistryVerified:boolean;
  routerVerified:boolean;
  runpodAdapterVerified:boolean;
  resultProtocolVerified:boolean;
  offlineFallbackVerified:boolean;
  physicalHomebaseObserved:boolean;
  runpodLiveReceiptObserved:boolean;
  backupRestoreObserved:boolean;
};

export type HomebaseFinalReport={
  schema:'jhadina.homebase-final.v1';
  sourceComplete:boolean;
  liveReady:boolean;
  blockers:readonly string[];
};

export function buildHomebaseFinalReport(e:HomebaseFinalEvidence):HomebaseFinalReport{
  const blockers:string[]=[
    ...validateHomebaseRuntimeContract(e.runtime),
    ...validateHomebaseStorage(e.storage),
    ...validateWorkerFleet(e.workers),
    ...validateHomebaseSubsystemMigrations(e.subsystems),
  ];
  if(!e.serviceRegistryVerified)blockers.push('HOMEBASE_SERVICE_REGISTRY_UNVERIFIED');
  if(!e.routerVerified)blockers.push('HOMEBASE_ROUTER_UNVERIFIED');
  if(!e.runpodAdapterVerified)blockers.push('HOMEBASE_RUNPOD_ADAPTER_UNVERIFIED');
  if(!e.resultProtocolVerified)blockers.push('HOMEBASE_RESULT_PROTOCOL_UNVERIFIED');
  if(!e.offlineFallbackVerified)blockers.push('HOMEBASE_OFFLINE_FALLBACK_UNVERIFIED');
  const sourceBlockers=[...blockers];
  if(!e.physicalHomebaseObserved)blockers.push('HOMEBASE_PHYSICAL_HARDWARE_EVIDENCE_REQUIRED');
  if(!e.runpodLiveReceiptObserved)blockers.push('HOMEBASE_RUNPOD_LIVE_RECEIPT_REQUIRED');
  if(!e.backupRestoreObserved)blockers.push('HOMEBASE_BACKUP_RESTORE_RECEIPT_REQUIRED');
  return Object.freeze({
    schema:'jhadina.homebase-final.v1',
    sourceComplete:sourceBlockers.length===0,
    liveReady:blockers.length===0,
    blockers:Object.freeze([...new Set(blockers)]),
  });
}

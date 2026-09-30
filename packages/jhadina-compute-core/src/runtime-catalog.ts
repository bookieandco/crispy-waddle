import {
  resolveComputeWorkload,
  validateResourceProfile,
  type ComputeResourceProfileCatalog,
  type ComputeWorkloadDraft,
} from './resource-profile.js';
import {
  resolveComputeWorker,
  type ComputeWorkerCatalog,
  type ResolvedComputeWorker,
} from './worker-catalog.js';
import type { ComputeWorkload } from './resource-contract.js';

export type ComputeRuntimeCatalog={
  version:string;
  generatedAt:string;
  resourceProfiles:ComputeResourceProfileCatalog;
  workerProfiles:ComputeWorkerCatalog;
};

export type ResolvedRuntimeBinding={
  catalogVersion:string;
  workload:ComputeWorkload;
  worker:ResolvedComputeWorker;
};

export function validateComputeRuntimeCatalog(
  catalog:ComputeRuntimeCatalog,
):readonly string[]{
  const reasons:string[]=[];
  if(!catalog.version.trim())reasons.push('COMPUTE_RUNTIME_CATALOG_VERSION_REQUIRED');
  if(!Number.isFinite(Date.parse(catalog.generatedAt)))reasons.push('COMPUTE_RUNTIME_CATALOG_TIME_INVALID');
  for(const [key,profile] of Object.entries(catalog.resourceProfiles)){
    if(key!==profile.id)reasons.push(`COMPUTE_RUNTIME_RESOURCE_KEY_MISMATCH:${key}`);
    for(const reason of validateResourceProfile(profile)){
      reasons.push(`COMPUTE_RUNTIME_RESOURCE_INVALID:${key}:${reason}`);
    }
  }
  for(const [key,profile] of Object.entries(catalog.workerProfiles)){
    if(key!==profile.id)reasons.push(`COMPUTE_RUNTIME_WORKER_KEY_MISMATCH:${key}`);
    if(!profile.allowedKinds.length)reasons.push(`COMPUTE_RUNTIME_WORKER_KIND_REQUIRED:${key}`);
    if(!profile.worker.image.trim())reasons.push(`COMPUTE_RUNTIME_WORKER_IMAGE_REQUIRED:${key}`);
  }
  return Object.freeze([...new Set(reasons)]);
}

export function resolveRuntimeBinding(
  draft:ComputeWorkloadDraft,
  workerProfileId:string,
  catalog:ComputeRuntimeCatalog,
  mode:'shadow'|'live',
):ResolvedRuntimeBinding{
  const reasons=validateComputeRuntimeCatalog(catalog);
  if(reasons.length)throw new Error(`COMPUTE_RUNTIME_CATALOG_INVALID:${reasons.join(',')}`);
  const workload=resolveComputeWorkload(draft,catalog.resourceProfiles);
  const worker=resolveComputeWorker(workload,workerProfileId,catalog.workerProfiles,mode);
  return {catalogVersion:catalog.version,workload,worker};
}

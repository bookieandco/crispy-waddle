import type { ComputeWorkload, ComputeWorkloadKind } from './resource-contract.js';
import type { ComputeExecutionTarget, ComputeWorkerSpec } from './execution-contract.js';

export type ComputeWorkerProfile={
  id:string;
  allowedKinds:readonly ComputeWorkloadKind[];
  target:ComputeExecutionTarget;
  worker:ComputeWorkerSpec;
};

export type ComputeWorkerCatalog=Readonly<Record<string,ComputeWorkerProfile>>;

export type ResolvedComputeWorker={
  profileId:string;
  target:ComputeExecutionTarget;
  worker:ComputeWorkerSpec;
};

export function resolveComputeWorker(
  workload:ComputeWorkload,
  profileId:string,
  catalog:ComputeWorkerCatalog,
  mode:'shadow'|'live',
):ResolvedComputeWorker{
  const profile=catalog[profileId];
  if(!profile)throw new Error(`COMPUTE_WORKER_PROFILE_NOT_FOUND:${profileId}`);
  if(profile.id!==profileId)throw new Error('COMPUTE_WORKER_PROFILE_ID_MISMATCH');
  if(!profile.allowedKinds.includes(workload.kind)){
    throw new Error(`COMPUTE_WORKER_KIND_MISMATCH:${workload.kind}`);
  }
  if(!profile.worker.image.trim())throw new Error('COMPUTE_WORKER_IMAGE_REQUIRED');
  if(mode==='live'&&!profile.worker.imageDigest?.trim()){
    throw new Error('COMPUTE_LIVE_WORKER_DIGEST_REQUIRED');
  }
  return {
    profileId,
    target:profile.target,
    worker:{
      ...profile.worker,
      command:profile.worker.command?[...profile.worker.command]:undefined,
      args:profile.worker.args?[...profile.worker.args]:undefined,
      envSecretRefs:profile.worker.envSecretRefs?[...profile.worker.envSecretRefs]:undefined,
    },
  };
}

export const DEFAULT_WORKER_PROFILE_IDS=Object.freeze({
  jllm:'jllm.inference',
  character:'character.runtime',
  image:'creative.image',
  video:'creative.video',
  voice:'creative.voice',
  audio:'creative.audio',
  foley:'creative.foley',
  render:'media.render',
  transcode:'media.transcode',
  threeD:'media.3d',
  training:'training.lora',
  embedding:'memory.embedding',
  memoryIndex:'memory.index',
  analysis:'analysis.batch',
} as const);

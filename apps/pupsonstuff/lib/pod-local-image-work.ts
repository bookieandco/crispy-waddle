import {
  planLocalCreativeDelegation,
  type CreativeLocalBackend,
  type CreativeLocalRequest,
} from '@jhadina/compute-core';
import {podCreativeComputeDraft,type PodCreativeComputeInput} from './compute-workload';

/** Bridges generalized 1000s-of-Shirts/POD artwork jobs to canonical Compute.
 * This only prepares a work draft. The POD creative job service owns submission,
 * saved outputs, print-area checks, approvals and Printify operations.
 */
export function prepareLocalPodImageWork(input:{
  request:CreativeLocalRequest;
  backends:readonly CreativeLocalBackend[];
  job:Omit<PodCreativeComputeInput,'profileId'|'allowCloudBurst'|'maxCostUsdPerHour'>;
}) {
  if(input.request.consumer!=='pod')
    throw new Error('POD_IMAGE_JOB_CONSUMER_MISMATCH');
  if(input.request.operation!=='text-to-image' &&
    input.request.operation!=='image-to-image' &&
    input.request.operation!=='image-upscale')
    throw new Error('POD_IMAGE_JOB_OPERATION_UNSUPPORTED');
  if(input.request.requestId!==input.job.jobId ||
    input.request.idempotencyKey!==input.job.idempotencyKey)
    throw new Error('POD_IMAGE_JOB_LINEAGE_MISMATCH');
  if(input.request.sourceAssetIds.join('|')!==input.job.sourceAssetIds.join('|'))
    throw new Error('POD_IMAGE_ASSET_LINEAGE_MISMATCH');
  const plan=planLocalCreativeDelegation(input.request,input.backends);
  if(plan.decision.status!=='eligible')
    return {status:'blocked' as const,plan};
  const computeDraft=podCreativeComputeDraft({
    ...input.job,
    profileId:plan.decision.computeProfileId,
    sensitiveData:input.job.sensitiveData??true,
    allowCloudBurst:false,
    maxCostUsdPerHour:0,
  });
  return {status:'prepared' as const,plan,computeDraft,submitted:false as const};
}

import {describe,it,expect} from 'vitest';
import {prepareLocalPodImageWork} from './pod-local-image-work';
import type {CreativeLocalBackend,CreativeLocalRequest} from '@jhadina/compute-core';
const req:CreativeLocalRequest={
  requestId:'job1',idempotencyKey:'idem1',ownerId:'owner',projectId:'shirts',
  consumer:'pod',operation:'text-to-image',sourceAssetIds:[],
  includesCustomerMedia:false,customerConsentGranted:false,
  sourceUsageRightsVerified:false,commercialUse:true,ownerAuthorized:true
};
const backend:CreativeLocalBackend={
  id:'comfy-certified',engine:'comfyui',capabilities:['text-to-image'],
  runtimeHealthy:true,approvedCheckpointSha256:'a'.repeat(64),
  commercialModelRightsVerified:true,workflowRightsVerified:true,localOwnedCompute:true,
  privateEndpointVerified:true,hasPaidExternalCalls:false,zeroMeteredProviderFeeVerified:true,
};
const job={jobId:'job1',idempotencyKey:'idem1',productId:'tee',sourceAssetIds:[]};
describe('1000s-of-Shirts reuses canonical free-local-only Compute and POD authority',()=>{
  it('prepares but never executes and never authorizes a remote billable burst',()=>{
    expect(prepareLocalPodImageWork({request:req,backends:[backend],job})).toMatchObject({
      status:'prepared',submitted:false,
      plan:{responsibleSubsystem:'pod-creative-job',productionActivated:false},
      computeDraft:{resourceProfileId:'pod.image.default',source:'pod',
        constraints:{allowCloudBurst:false,maxCostUsdPerHour:0}}});
  });
  it('fail-closed on missing worker, stale job id and source mismatch',()=>{
    expect(prepareLocalPodImageWork({request:req,backends:[],job})).toMatchObject({status:'blocked'});
    expect(()=>prepareLocalPodImageWork({request:req,backends:[backend],job:{...job,jobId:'other'}})).toThrow('LINEAGE_MISMATCH');
    expect(()=>prepareLocalPodImageWork({request:req,backends:[backend],job:{...job,sourceAssetIds:['unknown']}})).toThrow('ASSET_LINEAGE_MISMATCH');
  });
});

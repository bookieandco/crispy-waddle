import { describe, expect, it } from 'vitest';
import { computeProfileForCreative, planFreeFirstCreative, type CreativeLocalBackend, type CreativeLocalRequest } from './creative-local-first.js';

const request: CreativeLocalRequest = {
  requestId:'r1', ownerId:'owner1', projectId:'venture1', idempotencyKey:'r1',
  consumer:'pupsonstuff', operation:'image-to-image', sourceAssetIds:['private-pet-ref'],
  includesCustomerMedia:true, customerConsentGranted:true, commercialUse:true, ownerAuthorized:true,
};
const ready: CreativeLocalBackend = {
  id:'local-comfy-receipt', engine:'comfyui', capabilities:['image-to-image','text-to-video'],
  runtimeHealthy:true, approvedCheckpointSha256:'a'.repeat(64),
  commercialModelRightsVerified:true, workflowRightsVerified:true, localOwnedCompute:true,
  privateEndpointVerified:true, hasPaidExternalCalls:false, zeroMeteredProviderFeeVerified:true,
};

describe('shared free-first image/video planning', () => {
  it('never claims a runnable generator from a source catalog alone', () => {
    expect(planFreeFirstCreative(request, [])).toMatchObject({status:'blocked'});
  });
  it('admits only an observed owned private commercially licensed runtime, still without execution', () => {
    expect(planFreeFirstCreative(request, [ready])).toMatchObject({
      status:'eligible',backendId:'local-comfy-receipt',computeProfileId:'pupson.image.default',
      authority:{consumer:'pupsonstuff',idempotencyKey:'r1'},
    });
  });
  it('rejects cloud/metered/noncommercial/unverified candidates', () => {
    for (const changes of [
      {localOwnedCompute:false}, {hasPaidExternalCalls:true}, {zeroMeteredProviderFeeVerified:false},
      {privateEndpointVerified:false}, {commercialModelRightsVerified:false},
      {approvedCheckpointSha256:null}, {runtimeHealthy:false}, {workflowRightsVerified:false},
    ]) {
      expect(planFreeFirstCreative(request,[{...ready,...changes}]).status).toBe('blocked');
    }
  });
  it('requires consent, authoritative owner, references and durable job identity', () => {
    for (const changes of [
      {customerConsentGranted:false}, {ownerAuthorized:false}, {sourceAssetIds:[]},
      {idempotencyKey:''}, {ownerId:''},
    ]) {
      expect(planFreeFirstCreative({...request,...changes},[ready]).status).toBe('blocked');
    }
  });
  it('routes JLLM image/video requests to Director compute profiles; never creates separate JLLM generator', () => {
    expect(computeProfileForCreative('jllm','text-to-image')).toBe('director.image.default');
    expect(computeProfileForCreative('jllm','image-to-video')).toBe('director.video.default');
    expect(computeProfileForCreative('pod','text-to-image')).toBe('pod.image.default');
    expect(()=>computeProfileForCreative('pod','image-to-video')).toThrow('POD_VIDEO_REQUIRES_DIRECTOR_AUTHORITY');
  });
  it('prefers the OpenMontage local renderer for licensed footage montage', () => {
    const localMontage={...ready,id:'montage',engine:'openmontage' as const,capabilities:['video-montage'] as const};
    const other={...ready,id:'comfy-montage',capabilities:['video-montage'] as const};
    const plan=planFreeFirstCreative({...request,consumer:'director',operation:'video-montage',
      sourceAssetIds:['licensed-footage']},[other,localMontage]);
    expect(plan).toMatchObject({status:'eligible',backendId:'montage',computeProfileId:'director.video.default'});
  });
});

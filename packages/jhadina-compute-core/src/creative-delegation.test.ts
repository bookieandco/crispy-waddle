import {describe,it,expect} from 'vitest';
import {planLocalCreativeDelegation} from './creative-delegation.js';
import type {CreativeLocalRequest} from './creative-local-first.js';
const req:CreativeLocalRequest={
 requestId:'i1',ownerId:'owner',projectId:'project',idempotencyKey:'i1',
 consumer:'jllm',operation:'text-to-image',sourceAssetIds:[],includesCustomerMedia:false,
 customerConsentGranted:false,commercialUse:true,sourceUsageRightsVerified:false,ownerAuthorized:true
};
describe('one job authority for JLLM, Director and both POD stores',()=>{
  it('JLLM delegates image/video to existing Director, never starts paid generation',()=>{
    expect(planLocalCreativeDelegation(req,[])).toMatchObject({
      responsibleSubsystem:'director',submissionRoute:'director-authorized-take',productionActivated:false,
      decision:{status:'blocked'}});
    expect(planLocalCreativeDelegation({...req,operation:'text-to-video'},[]).responsibleSubsystem).toBe('director');
  });
  it('POD and Pupson keep distinct job authorities and compute profiles',()=>{
    expect(planLocalCreativeDelegation({...req,consumer:'pod'},[])).toMatchObject({
      responsibleSubsystem:'pod-creative-job',decision:{computeProfileId:'pod.image.default'}});
    expect(planLocalCreativeDelegation({...req,consumer:'pupsonstuff'},[])).toMatchObject({
      responsibleSubsystem:'pupson-creative-job',decision:{computeProfileId:'pupson.image.default'}});
  });
});

import { describe,expect,it } from 'vitest';
import {validateLocalImageCanary,validatePetPortraitRelease,type CreativeCanaryReceipt,type PetIdentityVisualReview} from './creative-production-acceptance.js';
const ok:CreativeCanaryReceipt={
  schema:'jhadina.local-creative-canary.v1',engine:'comfyui-local',
  observedAt:'2026-10-21T00:00:00Z',modelId:'pinned-local',
  checkpointSha256:'a'.repeat(64),workflowSha256:'b'.repeat(64),
  referenceSha256s:['c'.repeat(64)],elapsedMs:16000,runWasExecuted:true,
  localOnlyEndpoint:true,checkpointCommercialRightsOperatorAttested:true,
  output:{sha256:'d'.repeat(64),width:2048,height:2048,bytes:10000,format:'PNG',hasTransparency:true},
  petIdentityVerified:false,humanPrintReviewPassed:false,
};
const review:PetIdentityVisualReview={
  referenceSha256s:[...ok.referenceSha256s],outputSha256:ok.output.sha256,
  reviewerId:'operator-1',reviewedAt:'2026-10-21T00:00:00Z',
  petMarkingsMatch:true,eyesAndEarsMatch:true,edgeAndAlphaReviewed:true,
  printMasterVariantReviewed:true,printLayoutGatePassed:true,customerArtworkApproved:true,
};
describe('real GPU vs physical/visual proof separation',()=>{
  it('refuses catalog-only and unexecuted reports',()=>{
    expect(validateLocalImageCanary(undefined,{maximumElapsedMs:90000,requireCommercialUse:true}).pass).toBe(false);
    expect(validateLocalImageCanary({...ok,runWasExecuted:false},{maximumElapsedMs:90000,requireCommercialUse:true}).pass).toBe(false);
  });
  it('records real output dimensions without pretending pet likeness',()=>{
    expect(validateLocalImageCanary(ok,{maximumElapsedMs:90000,expectTransparency:true,requireCommercialUse:true}).pass).toBe(true);
    expect(validatePetPortraitRelease(ok,undefined).pass).toBe(false);
  });
  it('requires image hashes, reviewer, alpha check, exact print variant and customer approval',()=>{
    expect(validatePetPortraitRelease(ok,review).pass).toBe(true);
    expect(validatePetPortraitRelease(ok,{...review,petMarkingsMatch:false}).pass).toBe(false);
    expect(validatePetPortraitRelease(ok,{...review,outputSha256:'e'.repeat(64)}).pass).toBe(false);
    expect(validatePetPortraitRelease(ok,{...review,customerArtworkApproved:false}).pass).toBe(false);
  });
  it('rejects overslow outputs, unverifiable licences and requested transparency missing',()=>{
    expect(validateLocalImageCanary({...ok,elapsedMs:100000},{maximumElapsedMs:90000,requireCommercialUse:true}).pass).toBe(false);
    expect(validateLocalImageCanary({...ok,checkpointCommercialRightsOperatorAttested:false},{maximumElapsedMs:90000,requireCommercialUse:true}).pass).toBe(false);
    expect(validateLocalImageCanary({...ok,output:{...ok.output,hasTransparency:false}},{maximumElapsedMs:90000,expectTransparency:true,requireCommercialUse:true}).pass).toBe(false);
  });
});

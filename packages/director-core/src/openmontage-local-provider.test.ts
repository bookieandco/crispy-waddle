import {describe,it,expect,vi} from 'vitest';
import {buildOpenMontageLocalManifest,OpenMontageLocalProductionProvider,type OpenMontageOperatorBridge} from './openmontage-local-provider.js';
import type {WholeVideoProductionBrief} from './whole-video-provider.js';
const brief:WholeVideoProductionBrief={
  jobId:'job1',projectId:'project1',prompt:'Documentary of my own footage',creativeName:'Documentary',
  intent:{mode:'faceless',prompt:'Documentary montage',aspectRatio:'16:9',narration:false,captions:false,
    foley:false,commercialSafeOnly:true,providerPolicy:{localFreeFirst:true,allowPaidWithoutApproval:false}}
};
const source={assetId:'footage-1',sha256:'a'.repeat(64),rightsReceiptId:'rights-1',ownerApproved:true,kind:'original-video' as const};
describe('OpenMontage operator-owned agent stage',()=>{
  it('rejects unlicensed footage and cloud escalations',()=>{
    expect(()=>buildOpenMontageLocalManifest({brief,idempotencyKey:'idem',sources:[]})).toThrow('APPROVED_ORIGINAL');
    expect(()=>buildOpenMontageLocalManifest({brief,idempotencyKey:'idem',sources:[{...source,ownerApproved:false}]})).toThrow('APPROVED_ORIGINAL');
    expect(()=>buildOpenMontageLocalManifest({brief:{...brief,narration:{speakerIdentityRef:'jhadina',authority:'CANONICAL_VOICE_REFERENCE'}},idempotencyKey:'idem',sources:[source]})).toThrow('NOT_CERTIFIED');
  });
  it('creates a reviewed no-paid-call manifest with authoritative job identity',()=>{
    expect(buildOpenMontageLocalManifest({brief,idempotencyKey:'idem',sources:[source]})).toMatchObject({
      schema:'director.openmontage.local.v1',remoteApiCallsAllowed:false,
      gate:'storyboard-review-required',sourceAssets:[source],idempotencyKey:'idem'});
  });
  it('returns job IDs but never claims a ready video until operator validates one',async()=>{
    const bridge:OpenMontageOperatorBridge={
      submit:vi.fn().mockResolvedValue({jobId:'operator-job',status:'queued'}),
      status:vi.fn().mockResolvedValue({providerJobId:'operator-job',status:'processing'}),
      download:vi.fn(),cancel:vi.fn().mockResolvedValue(undefined),
    };
    const provider=new OpenMontageLocalProductionProvider(bridge,async()=>[source]);
    expect(await provider.submit(brief,'idem')).toMatchObject({providerJobId:'operator-job',status:'queued',qualityClaim:false});
    await expect(provider.download('operator-job')).rejects.toThrow('NOT_CERTIFIED_READY');
    expect(bridge.download).not.toHaveBeenCalled();
  });
});

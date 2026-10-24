import {describe,it,expect,vi} from 'vitest';
import {createConfiguredWholeVideoProviders} from './director-whole-video-providers';
describe('optional reviewed OpenMontage operator bridge',()=>{
  it('is never enabled from catalog names or environment defaults alone',()=>{
    const configured=createConfiguredWholeVideoProviders();
    expect(configured.some(provider=>provider.descriptor.id==='openmontage-local')).toBe(false);
  });
  it('joins existing Director video provider registry only through explicit trusted injection',()=>{
    const bridge={
      submit:vi.fn().mockResolvedValue({jobId:'id1',status:'queued'}),
      status:vi.fn().mockResolvedValue({providerJobId:'id1',status:'processing'}),
      download:vi.fn(),cancel:vi.fn(),
    };
    const list=createConfiguredWholeVideoProviders({
      openMontage:{bridge,findApprovedSources:async()=>[{
        assetId:'clip',sha256:'a'.repeat(64),rightsReceiptId:'licence',ownerApproved:true,kind:'original-video' as const,
      }]},
    });
    expect(list.some(provider=>provider.descriptor.id==='openmontage-local')).toBe(true);
  });
});

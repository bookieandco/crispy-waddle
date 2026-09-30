import {describe,expect,it,vi} from 'vitest';
import {prepareMusicPaidCampaignProposal} from './music-paid-proposal-bridge';

const budget={approvedMinor:50000,spentMinor:0,experimentReserveMinor:10000,breakoutReserveMinor:30000,productionReserveMinor:10000,currency:'USD'};
const rights={assetId:'song-1',masterOwnershipKnown:true,publishingKnown:true,sampleStatus:'none' as const,thirdPartyUsageStatus:'none' as const,evidenceRefs:['rights:1']};
const campaign={brandId:'brand:atwood-bookie',name:'Song test',objective:'stream',channel:'meta' as const,providerAccountId:'acct',audienceIds:['a1'],creativeIds:['c1'],currency:'USD',dailyBudgetMinor:1000};

describe('Music paid proposal bridge',()=>{
  it('does not create a paid campaign without validated attack evidence',async()=>{
    const requester=vi.fn();
    const result=await prepareMusicPaidCampaignProposal({budget,rights,requestedMinor:5000,preAuthorizedLimitMinor:5000,campaign},{requester});
    expect(result.decision.action).toBe('MICRO_TEST');
    expect(result.approvalRequired).toBe(true);
    expect(requester).toHaveBeenCalledTimes(1);
  });
  it('stops before Growth when rights are blocked',async()=>{
    const requester=vi.fn();
    const result=await prepareMusicPaidCampaignProposal({
      budget,rights:{...rights,sampleStatus:'blocked',evidenceRefs:['rights:block']},requestedMinor:5000,preAuthorizedLimitMinor:5000,campaign,
    },{requester});
    expect(result.decision.action).toBe('STOP');
    expect(requester).not.toHaveBeenCalled();
    expect(result.externalPublishStarted).toBe(false);
  });
});

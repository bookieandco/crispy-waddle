import {decidePromotionSpend,type CreativeOutlier,type PromotionBudget,type RightsRecord,type SpendDecision,type PaidMediaChannel} from '@jhadina/growth-core';
import {requestPaidCampaign,type RequestedPaidCampaign,type CreatePaidCampaignInput} from '../growth/governed-paid-campaign';

export interface MusicPaidProposalInput{
  budget:PromotionBudget;
  outlier?:CreativeOutlier;
  rights:RightsRecord;
  requestedMinor:number;
  preAuthorizedLimitMinor:number;
  campaign:Omit<CreatePaidCampaignInput,'dailyBudgetMinor'|'lifetimeBudgetMinor'> & {dailyBudgetMinor:number};
}

export interface MusicPaidProposalResult{
  decision:SpendDecision;
  campaign?:RequestedPaidCampaign;
  externalPublishStarted:false;
  approvalRequired:boolean;
}

export async function prepareMusicPaidCampaignProposal(
  input:MusicPaidProposalInput,
  overrides:{requester?:(input:CreatePaidCampaignInput)=>Promise<RequestedPaidCampaign>}={},
):Promise<MusicPaidProposalResult>{
  const mode=input.outlier?.status==='validated'?'ATTACK':'SEARCH';
  const decision=decidePromotionSpend({
    budget:input.budget,
    mode,
    outlier:input.outlier,
    rights:input.rights,
    requestedMinor:input.requestedMinor,
    preAuthorizedLimitMinor:input.preAuthorizedLimitMinor,
  });
  if(decision.action==='HOLD'||decision.action==='STOP'||decision.authorizedMinor<=0){
    return Object.freeze({decision,externalPublishStarted:false,approvalRequired:false});
  }
  const dailyBudgetMinor=Math.min(input.campaign.dailyBudgetMinor,decision.authorizedMinor);
  if(!Number.isSafeInteger(dailyBudgetMinor)||dailyBudgetMinor<=0)throw new Error('MUSIC_PAID_DAILY_BUDGET_INVALID');
  const requester=overrides.requester??requestPaidCampaign;
  const campaign=await requester({
    ...input.campaign,
    channel:input.campaign.channel as PaidMediaChannel,
    dailyBudgetMinor,
    lifetimeBudgetMinor:decision.authorizedMinor,
  });
  return Object.freeze({decision,campaign,externalPublishStarted:false,approvalRequired:true});
}

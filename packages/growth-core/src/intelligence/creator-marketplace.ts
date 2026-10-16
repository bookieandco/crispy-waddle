/** Free-first creator marketplace equivalents. Planning and evidence only; no scraping, sending, payment, publishing, or provider API. */
import type { CreatorEvidence, CreatorFitAssessment } from './creator-outreach.js';
import { assertCreatorEvidence } from './creator-outreach.js';
import { calculateCustomerEconomics } from '../economics/customer-economics.js';

export type MarketplaceSource='direct_manual'|'social_cat_manual'|'stack_influence_manual';
export const FREE_FIRST_PROVIDER_REGISTRY = Object.freeze({
 direct_manual:{name:'Direct outreach',boundary:'manual_import_only',paidExecution:false},
 social_cat_manual:{name:'Social Cat (reference only)',boundary:'manual_import_only',paidExecution:false},
 stack_influence_manual:{name:'Stack Influence (reference only)',boundary:'manual_import_only',paidExecution:false},
 owned_organic:{name:'Owned channels',boundary:'owned_channel_only',paidExecution:false},
 realize_manual_report:{name:'Realize report only',boundary:'manual_import_only',paidExecution:false},
} as const);
export interface CreatorCampaignBrief {
 id:string;ownerId:string;brandId:string;offerRef:string;destinationRef:string;source:MarketplaceSource;
 nicheTags:readonly string[];requiredProductAffinity:readonly string[];desiredPlatforms:readonly string[];
 maximumEvidenceAgeDays:number;authorizedExternalSpendUsd:0;evidenceRefs:readonly string[];
}
export interface CreatorCandidate {
 evidence:CreatorEvidence;contactRef?:string;consentForOutreach:boolean;
 suppression:'none'|'declined'|'do_not_contact';
}
export interface CreatorCandidateRanking {
 creatorRef:string;campaignId:string;fit:CreatorFitAssessment;score:number;
 blockers:readonly string[];eligibleForDraft:boolean;authorizationEffect:'NONE';
}
const normalized=(values:readonly string[])=>[...new Set(values.map(x=>x.trim().toLowerCase()).filter(Boolean))];
const evidence=(refs:readonly string[])=>refs.length>0&&refs.every(x=>x.trim().length>0);
const usd=(n:number)=>Number.isFinite(n)&&n>=0;
export function assessMarketplaceCandidate(brief:CreatorCampaignBrief,candidate:CreatorCandidate,nowIso:string):CreatorCandidateRanking {
 for(const value of [brief.id,brief.ownerId,brief.brandId,brief.offerRef,brief.destinationRef])if(!value.trim())throw Error('CREATOR_MARKETPLACE_ID_REQUIRED');
 if(!evidence(brief.evidenceRefs))throw Error('CREATOR_MARKETPLACE_EVIDENCE_REQUIRED');
 if(brief.authorizedExternalSpendUsd!==0)throw Error('CREATOR_MARKETPLACE_SPEND_DISABLED');
 if(!Number.isInteger(brief.maximumEvidenceAgeDays)||brief.maximumEvidenceAgeDays<1||brief.maximumEvidenceAgeDays>365)throw Error('CREATOR_MARKETPLACE_AGE_WINDOW_INVALID');
 assertCreatorEvidence(candidate.evidence);
 const now=Date.parse(nowIso),observed=Date.parse(candidate.evidence.observedAt);
 if(!Number.isFinite(now)||!Number.isFinite(observed))throw Error('CREATOR_MARKETPLACE_TIMESTAMP_INVALID');
 const blockers:string[]=[];
 if(observed>now||(now-observed)/86400000>brief.maximumEvidenceAgeDays)blockers.push('STALE_OR_FUTURE_EVIDENCE');
 if(!normalized(brief.desiredPlatforms).includes(candidate.evidence.platform.trim().toLowerCase()))blockers.push('PLATFORM_MISMATCH');
 if(candidate.suppression!=='none')blockers.push('DO_NOT_CONTACT');
 if(!candidate.consentForOutreach||!candidate.contactRef?.trim())blockers.push('CONSENTED_CONTACT_REQUIRED');
 const niche=normalized(brief.nicheTags),affinity=normalized(brief.requiredProductAffinity);
 const n=new Set(normalized(candidate.evidence.nicheTags)),a=new Set(normalized(candidate.evidence.productAffinitySignals));
 const nf=niche.length?niche.filter(x=>n.has(x)).length/niche.length:0;
 const af=affinity.length?affinity.filter(x=>a.has(x)).length/affinity.length:0;
 if(niche.length&&!nf)blockers.push('NICHE_FIT_UNSUPPORTED');
 if(affinity.length&&!af)blockers.push('PRODUCT_AFFINITY_UNSUPPORTED');
 const engagement=candidate.evidence.engagementRate;
 // Missing engagement does not invent a score or imply a fake follower minimum.
 const score=Math.round(100*(.55*nf+.35*af+.1*(engagement===undefined?0:Math.min(1,engagement/.1))));
 const fit:CreatorFitAssessment={
  assessmentId:'creator-fit:'+brief.id+':'+candidate.evidence.creatorRef,
  creatorRef:candidate.evidence.creatorRef,campaignId:brief.id,
  suitability:blockers.length?'unsupported':score>=60?'supported':'partially_supported',
  commercialFit:score,finding:blockers.length?'Blocked: '+blockers.join(', '):'Evidence-based fit only; not predicted sales',
  evidenceRefs:[...new Set([...brief.evidenceRefs,...candidate.evidence.evidenceRefs])],observedAt:nowIso
 };
 return Object.freeze({creatorRef:candidate.evidence.creatorRef,campaignId:brief.id,fit,score,
  blockers:Object.freeze(blockers),eligibleForDraft:!blockers.length&&score>=60,authorizationEffect:'NONE' as const});
}
export function rankMarketplaceCandidates(brief:CreatorCampaignBrief,candidates:readonly CreatorCandidate[],nowIso:string):readonly CreatorCandidateRanking[] {
 const seen=new Set<string>();
 return Object.freeze(candidates.map(c=>{
  if(seen.has(c.evidence.creatorRef))throw Error('CREATOR_MARKETPLACE_DUPLICATE_CREATOR');
  seen.add(c.evidence.creatorRef);return assessMarketplaceCandidate(brief,c,nowIso);
 }).sort((a,b)=>Number(b.eligibleForDraft)-Number(a.eligibleForDraft)||b.score-a.score||a.creatorRef.localeCompare(b.creatorRef)));
}
export interface CreatorSeedEconomics {
 productCostUsd:number|null;shippingUsd:number|null;creatorFeeUsd:number|null;platformFeeUsd:number|null;
 otherCostsUsd:number|null;reimbursementUsd:number|null;creatorCheckoutUsd:number|null;
}
export interface CreatorCollaborationDraft {
 id:string;campaignId:string;creatorRef:string;ownerId:string;brandId:string;offerRef:string;destinationRef:string;source:MarketplaceSource;
 estimatedMarketingCostUsd:number|null;blockers:readonly string[];requiredDisclosure:string;
 rightsState:'NOT_GRANTED';state:'DRAFT_ONLY';externalExecution:false;approvalAuthority:'SOCIAL_ACTION_CORE_REQUIRED';evidenceRefs:readonly string[];
}
export function compileCollaborationDraft(brief:CreatorCampaignBrief,ranking:CreatorCandidateRanking,e:CreatorSeedEconomics):CreatorCollaborationDraft {
 if(ranking.campaignId!==brief.id||ranking.fit.creatorRef!==ranking.creatorRef)throw Error('CREATOR_MARKETPLACE_CAMPAIGN_MISMATCH');
 const blockers=[...ranking.blockers];
 if(!ranking.eligibleForDraft)blockers.push('CREATOR_FIT_NOT_SUPPORTED');
 const entries=Object.entries(e) as Array<[keyof CreatorSeedEconomics,number|null]>;
 for(const [key,value] of entries){
  if(value===null)blockers.push('QUOTE_MISSING:'+key);
  else if(!usd(value))throw Error('CREATOR_MARKETPLACE_COST_INVALID:'+key);
 }
 let estimatedMarketingCostUsd:number|null=null;
 if(entries.every(([,value])=>value!==null)){
  const v=e as {[K in keyof CreatorSeedEconomics]:number};
  // Creator checkout revenue is not attributed acquisition revenue.
  estimatedMarketingCostUsd=Math.round(100*(v.productCostUsd+v.shippingUsd+v.creatorFeeUsd+v.platformFeeUsd+v.otherCostsUsd+
   Math.max(0,v.reimbursementUsd-v.creatorCheckoutUsd)))/100;
  if(estimatedMarketingCostUsd>brief.authorizedExternalSpendUsd)blockers.push('OWNER_SPEND_APPROVAL_REQUIRED');
 }
 return Object.freeze({id:'collab:'+brief.id+':'+ranking.creatorRef,campaignId:brief.id,creatorRef:ranking.creatorRef,ownerId:brief.ownerId,
  brandId:brief.brandId,offerRef:brief.offerRef,destinationRef:brief.destinationRef,source:brief.source,estimatedMarketingCostUsd,
  blockers:Object.freeze([...new Set(blockers)]),requiredDisclosure:'Disclose gifted products, payment or other material connections in the post.',
  rightsState:'NOT_GRANTED' as const,state:'DRAFT_ONLY' as const,externalExecution:false as const,
  approvalAuthority:'SOCIAL_ACTION_CORE_REQUIRED' as const,evidenceRefs:Object.freeze([...ranking.fit.evidenceRefs])});
}
export interface CreatorAssetLicense {
 assetRef:string;creatorRef:string;ownerId:string;brandId:string;
 permissions:readonly ('organic_repost'|'paid_ad'|'website'|'email')[];
 grantedAt:string;expiresAt:string;proofRefs:readonly string[];revokedAt?:string;
}
export function assessCreatorAssetReuse(input:{license:CreatorAssetLicense;ownerId:string;brandId:string;creatorRef:string;assetRef:string;
 desiredUse:CreatorAssetLicense['permissions'][number];nowIso:string}){
 const l=input.license,now=Date.parse(input.nowIso),granted=Date.parse(l.grantedAt),expires=Date.parse(l.expiresAt);
 if(![now,granted,expires].every(Number.isFinite))throw Error('CREATOR_MARKETPLACE_LICENSE_DATE_INVALID');
 const blockers:string[]=[];
 if(l.ownerId!==input.ownerId||l.brandId!==input.brandId||l.creatorRef!==input.creatorRef||l.assetRef!==input.assetRef)blockers.push('LICENSE_SCOPE_MISMATCH');
 if(!evidence(l.proofRefs))blockers.push('LICENSE_PROOF_REQUIRED');
 if(granted>now||now>=expires)blockers.push('LICENSE_NOT_ACTIVE');
 if(l.revokedAt!==undefined){
  const revoked=Date.parse(l.revokedAt);
  if(!Number.isFinite(revoked))throw Error('CREATOR_MARKETPLACE_LICENSE_REVOKED_DATE_INVALID');
  if(revoked<=now)blockers.push('LICENSE_REVOKED');
 }
 if(!l.permissions.includes(input.desiredUse))blockers.push('USE_NOT_LICENSED');
 return Object.freeze({allowedForProposal:!blockers.length,blockers:Object.freeze(blockers),
  authority:'RIGHTS_CHECK_ONLY' as const,publicationAuthorized:false as const});
}
export interface CreatorCampaignObservation {
 campaignId:string;ownerId:string;brandId:string;observedAt:string;attributedNewCustomers:number;
 attributedCustomerRevenueUsd:number;refundsUsd:number;fulfillmentCostsUsd:number;actualMarketingCostUsd:number;evidenceRefs:readonly string[];
}
export function assessObservedCreatorOutcome(brief:CreatorCampaignBrief,result:CreatorCampaignObservation){
 if(result.campaignId!==brief.id||result.ownerId!==brief.ownerId||result.brandId!==brief.brandId)throw Error('CREATOR_MARKETPLACE_OUTCOME_SCOPE_MISMATCH');
 if(!evidence(result.evidenceRefs))throw Error('CREATOR_MARKETPLACE_OUTCOME_EVIDENCE_REQUIRED');
 if(!Number.isFinite(Date.parse(result.observedAt)))throw Error('CREATOR_MARKETPLACE_OUTCOME_DATE_INVALID');
 if(!Number.isInteger(result.attributedNewCustomers)||result.attributedNewCustomers<0)throw Error('CREATOR_MARKETPLACE_CUSTOMERS_INVALID');
 for(const value of [result.attributedCustomerRevenueUsd,result.refundsUsd,result.fulfillmentCostsUsd,result.actualMarketingCostUsd])if(!usd(value))throw Error('CREATOR_MARKETPLACE_OUTCOME_AMOUNT_INVALID');
 const economics=calculateCustomerEconomics({spend:result.actualMarketingCostUsd,newCustomers:result.attributedNewCustomers,
  revenue:result.attributedCustomerRevenueUsd,refunds:result.refundsUsd,variableCosts:result.fulfillmentCostsUsd});
 return Object.freeze({campaignId:brief.id,ownerId:brief.ownerId,brandId:brief.brandId,economics,
  netAfterMarketingUsd:economics.contributionMargin-result.actualMarketingCostUsd,
  evidenceRefs:Object.freeze([...result.evidenceRefs]),authority:'OBSERVATION_ONLY' as const,externalExecution:false as const});
}

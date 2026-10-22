import {describe,expect,it} from 'vitest';
import {assessMarketplaceCandidate,rankMarketplaceCandidates,compileCollaborationDraft,assessCreatorAssetReuse,
 assessObservedCreatorOutcome,FREE_FIRST_PROVIDER_REGISTRY} from './creator-marketplace.js';
import type {CreatorCampaignBrief,CreatorCandidate,CreatorSeedEconomics} from './creator-marketplace.js';

const now='2026-10-15T12:00:00Z';
const brief:CreatorCampaignBrief={id:'test:1',ownerId:'owner:1',brandId:'pupsonstuff',offerRef:'offer:portrait',destinationRef:'shop:pup',
 source:'direct_manual',nicheTags:['dogs','pets'],requiredProductAffinity:['dog owner'],desiredPlatforms:['instagram'],
 maximumEvidenceAgeDays:30,authorizedExternalSpendUsd:0,evidenceRefs:['brief:1']};
const creator:CreatorCandidate={consentForOutreach:true,contactRef:'owner-verified:email',suppression:'none',
 evidence:{creatorRef:'creator:1',platform:'instagram',sourceRef:'manually-observed:1',observedAt:now,evidenceRefs:['creator:source'],
 nicheTags:['dogs','pets'],audienceSignals:['dog owners'],productAffinitySignals:['dog owner'],engagementRate:0.04}};
const free:CreatorSeedEconomics={productCostUsd:0,shippingUsd:0,creatorFeeUsd:0,platformFeeUsd:0,otherCostsUsd:0,reimbursementUsd:0,creatorCheckoutUsd:0};

describe('free-first creator collaborations',()=>{
 it('only registers non-executing provider references',()=>{
  expect(FREE_FIRST_PROVIDER_REGISTRY.realize_manual_report.paidExecution).toBe(false);
  expect(FREE_FIRST_PROVIDER_REGISTRY.stack_influence_manual.boundary).toBe('manual_import_only');
 });
 it('ranks real creator evidence; never grants send permission',()=>{
  const result=assessMarketplaceCandidate(brief,creator,now);
  expect(result.eligibleForDraft).toBe(true);
  expect(result.authorizationEffect).toBe('NONE');
  expect(result.fit.evidenceRefs).toEqual(['brief:1','creator:source']);
  expect(rankMarketplaceCandidates(brief,[creator],now)).toHaveLength(1);
  expect(()=>rankMarketplaceCandidates(brief,[creator,creator],now)).toThrow('DUPLICATE_CREATOR');
 });
 it('opt-outs, missing consent and stale evidence block outreach',()=>{
  expect(assessMarketplaceCandidate(brief,{...creator,suppression:'do_not_contact'},now).blockers).toContain('DO_NOT_CONTACT');
  expect(assessMarketplaceCandidate(brief,{...creator,consentForOutreach:false},now).eligibleForDraft).toBe(false);
  expect(assessMarketplaceCandidate(brief,{...creator,evidence:{...creator.evidence,observedAt:'2026-01-01T00:00:00Z'}},now).blockers)
    .toContain('STALE_OR_FUTURE_EVIDENCE');
 });
 it('unknown platform price is not zero; every positive amount requires approval',()=>{
  const r=assessMarketplaceCandidate(brief,creator,now);
  const unknown=compileCollaborationDraft(brief,r,{...free,platformFeeUsd:null});
  expect(unknown.estimatedMarketingCostUsd).toBeNull();
  expect(unknown.blockers).toContain('QUOTE_MISSING:platformFeeUsd');
  const paid=compileCollaborationDraft(brief,r,{...free,productCostUsd:20,shippingUsd:5});
  expect(paid.estimatedMarketingCostUsd).toBe(25);
  expect(paid.blockers).toContain('OWNER_SPEND_APPROVAL_REQUIRED');
  expect(paid.state).toBe('DRAFT_ONLY');
  expect(paid.externalExecution).toBe(false);
 });
 it('offsets creator self-checkout reimbursement without inflating acquisition revenue',()=>{
  const plan=compileCollaborationDraft(brief,assessMarketplaceCandidate(brief,creator,now),{
   ...free,productCostUsd:12,reimbursementUsd:30,creatorCheckoutUsd:30});
  expect(plan.estimatedMarketingCostUsd).toBe(12);
  const result=assessObservedCreatorOutcome(brief,{campaignId:brief.id,ownerId:brief.ownerId,brandId:brief.brandId,
   observedAt:now,attributedNewCustomers:2,attributedCustomerRevenueUsd:100,refundsUsd:0,
   fulfillmentCostsUsd:40,actualMarketingCostUsd:12,evidenceRefs:['real-orders:1']});
  expect(result.netAfterMarketingUsd).toBe(48);
  expect(result.authority).toBe('OBSERVATION_ONLY');
 });
 it('requires exact creator/asset/use/owner license before a reuse proposal',()=>{
  const license={assetRef:'ugc:1',creatorRef:'creator:1',ownerId:'owner:1',brandId:'pupsonstuff',
   permissions:['organic_repost'] as const,grantedAt:'2026-10-01T00:00:00Z',
   expiresAt:'2027-01-01T00:00:00Z',proofRefs:['license:1']};
  const props={license,ownerId:'owner:1',brandId:'pupsonstuff',creatorRef:'creator:1',assetRef:'ugc:1',nowIso:now};
  expect(assessCreatorAssetReuse({...props,desiredUse:'organic_repost'}).allowedForProposal).toBe(true);
  expect(assessCreatorAssetReuse({...props,desiredUse:'paid_ad'}).blockers).toContain('USE_NOT_LICENSED');
  expect(assessCreatorAssetReuse({...props,ownerId:'other',desiredUse:'organic_repost'}).blockers).toContain('LICENSE_SCOPE_MISMATCH');
  expect(assessCreatorAssetReuse({...props,license:{...license,revokedAt:'2026-10-10T00:00:00Z'},desiredUse:'organic_repost'}).blockers).toContain('LICENSE_REVOKED');
 });
 it('rejects outcome attribution across owners or brands',()=>{
  expect(()=>assessObservedCreatorOutcome(brief,{campaignId:brief.id,ownerId:'other',brandId:brief.brandId,
   observedAt:now,attributedNewCustomers:0,attributedCustomerRevenueUsd:0,refundsUsd:0,fulfillmentCostsUsd:0,
   actualMarketingCostUsd:0,evidenceRefs:['receipt']})).toThrow('OUTCOME_SCOPE_MISMATCH');
 });
});

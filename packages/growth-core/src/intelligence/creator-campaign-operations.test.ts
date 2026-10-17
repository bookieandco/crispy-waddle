import {describe,it,expect} from 'vitest';
import {prepareManualCreatorImport,buildFreeOutreachDraft,prepareCanonicalFreeCreatorTouch,planCollaborationTransition,buildDirectorCreatorBrief,
 assessFreeCampaignReport,buildUnpaidAdStudy,validateFreeCampaignRecord} from './creator-campaign-operations.js';
import type {CreatorCampaignBrief,CreatorCandidate} from './creator-marketplace.js';
const now='2026-10-16T17:00:00Z';
const brief:CreatorCampaignBrief={id:'campaign:pup:pilot',ownerId:'owner:1',brandId:'pupsonstuff',offerRef:'portrait',
 destinationRef:'shop:portrait',source:'direct_manual',nicheTags:['dogs'],requiredProductAffinity:['dog owner'],
 desiredPlatforms:['instagram'],maximumEvidenceAgeDays:20,authorizedExternalSpendUsd:0,evidenceRefs:['owner:brief:1']};
const candidate:CreatorCandidate={consentForOutreach:true,contactRef:'verified:email',suppression:'none',
 evidence:{creatorRef:'creator:doglover',platform:'instagram',sourceRef:'manual:1',observedAt:now,
 evidenceRefs:['source:1'],nicheTags:['dogs'],audienceSignals:['pets'],productAffinitySignals:['dog owner']}};
describe('SOCIAL-FREE.08-.16 zero spend free marketing pipeline',()=>{
 it('deduplicates opted-in manual imports without implying permission',()=>{
  const lead={platform:'instagram',handle:'@DOGlover',nicheTags:['dogs'],
   productAffinitySignals:['dog owner'],contactPermission:'unknown' as const,sourceRef:'manual:user',
   observedAt:now,evidenceRefs:['manual:source']};
  const result=prepareManualCreatorImport([lead,lead]);
  expect(result).toHaveLength(1);
  expect(result[0]?.handle).toBe('doglover');
  expect(result[0]?.contactPermission).toBe('unknown');
  expect(()=>prepareManualCreatorImport([])).toThrow('IMPORT_LIMIT');
 });
 it('generates private drafts only with consent and matching fresh evidence',()=>{
  const proposal=buildFreeOutreachDraft({brief,candidate,channel:'instagram',brandDisplayName:'PupsonStuff',
   productDescription:'custom dog art',nowIso:now});
  expect(proposal.requiresOwnerApproval).toBe(true);
  expect(proposal.sendAuthorized).toBe(false);
  expect(proposal.text).toContain('possible collaboration');
  expect(()=>buildFreeOutreachDraft({brief,candidate:{...candidate,suppression:'do_not_contact'},
   channel:'instagram',brandDisplayName:'PupsonStuff',productDescription:'custom dog art',nowIso:now})).toThrow('NOT_ELIGIBLE');
 });
 it('compiles only the existing Growth outreach child proposal, not a publisher',()=>{
  const result=prepareCanonicalFreeCreatorTouch({brief,candidate,brandDisplayName:'PupsonStuff',
   productDescription:'a dog portrait',brandVoiceProfileRef:'profile:pup:1',
   channelVoiceProfileRef:'voice:ig:1',createdAt:now,expiresAt:'2026-10-23T17:00:00Z'});
  expect(result.proposal.creatorRef).toBe(candidate.evidence.creatorRef);
  expect(result.proposal.exactMessageFingerprint).toContain('PupsonStuff');
  expect(result.sendAuthorized).toBe(false);
  expect(result.approvalBoundary).toBe('Social/Action Core');
 });
 it('observes manually evidenced transitions; forbids skipping terms or fabricated execution',()=>{
  expect(planCollaborationTransition({from:'draft',to:'contact_proposed',evidenceRefs:['owner:1'],source:'manual_record'}).authority).toBe('OBSERVATION_ONLY');
  expect(()=>planCollaborationTransition({from:'draft',to:'shipment_recorded',evidenceRefs:['owner:1'],
   source:'manual_record'})).toThrow('INVALID_TRANSITION');
  expect(()=>planCollaborationTransition({from:'completed_recorded',to:'draft',evidenceRefs:['owner:1'],
   source:'manual_record'})).toThrow('INVALID_TRANSITION');
 });
 it('keeps Director briefs unpublished and makes FTC disclosures required',()=>{
  const plan=buildDirectorCreatorBrief({campaignId:brief.id,brandId:brief.brandId,offerRef:brief.offerRef,
   creatorRef:candidate.evidence.creatorRef,format:'short_video',disclosure:'Gifted by PupsonStuff',
   evidenceRefs:['owner:1']});
  expect(plan.qc).toContain('material-connection disclosure');
  expect(plan.mediaGenerated).toBe(false);
  expect(plan.publishAuthorized).toBe(false);
 });
 it('does not infer ROI when no externally verified orders exist',()=>{
  const unobserved=assessFreeCampaignReport({brief,observations:[],organicViews:null,ugcPosts:1,licensedAssets:0});
  expect(unobserved.profitAfterMarketingUsd).toBeNull();
  expect(unobserved.scorecardState).toBe('INSUFFICIENT_COMMERCIAL_EVIDENCE');
  expect(unobserved.scaleAuthorized).toBe(false);
  const observed=assessFreeCampaignReport({brief,organicViews:1000,ugcPosts:2,licensedAssets:1,
   observations:[{campaignId:brief.id,ownerId:brief.ownerId,brandId:brief.brandId,observedAt:now,
    attributedNewCustomers:2,attributedCustomerRevenueUsd:100,refundsUsd:0,fulfillmentCostsUsd:35,
    actualMarketingCostUsd:15,evidenceRefs:['shop:real-order-receipts']}]});
  expect(observed.profitAfterMarketingUsd).toBe(50);
  expect(observed.cac).toBe(7.5);
 });
 it('never provisions purchased ad impressions',()=>{
  const plan=buildUnpaidAdStudy({brandId:'pupsonstuff',campaignId:brief.id,
   creativeRefs:['director:concept:1','director:concept:2'],destinationRef:brief.destinationRef,
   hypothesis:'dog portraits make better carousel posts',organicEvidenceRefs:['test:brief']});
  expect(plan.plannedSpendUsd).toBe(0);
  expect(plan.channel).toBe('ORGANIC_ONLY');
  expect(plan.externalActionAuthorized).toBe(false);
 });
 it('rejects forged approval fields and secret payloads in persisted records',()=>{
  const record={id:'record:1',kind:'creator' as const,brandId:'pupsonstuff',campaignRef:null,
   payload:{handle:'dogowner'},evidenceRefs:['owner:manual'],observedAt:now,
   status:'DRAFT_ONLY' as const,externalActionAuthorized:false as const,moneyMovementAuthorized:false as const};
  expect(validateFreeCampaignRecord(record).status).toBe('DRAFT_ONLY');
  expect(()=>validateFreeCampaignRecord({...record,moneyMovementAuthorized:true as unknown as false})).toThrow('EXECUTION_FORBIDDEN');
  expect(()=>validateFreeCampaignRecord({...record,payload:{accessToken:'not-allowed'}})).toThrow('SECRET_FIELD_FORBIDDEN');
 });
});

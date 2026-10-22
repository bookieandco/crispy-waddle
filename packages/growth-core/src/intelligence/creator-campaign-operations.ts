/**
 * SOCIAL-FREE.08-.14: free, evidence-only campaign coordination.
 * Integrates with Growth creator outreach, existing A/B experiments,
 * and Social/Action Core approvals. NO dispatch, purchase or publication.
 */
import type {CreatorCampaignBrief,CreatorCandidate,CreatorCampaignObservation} from './creator-marketplace.js';
import {prepareOutreachTouchProposal} from './creator-outreach.js';
import type {OutreachPlan,OutreachTouchDraft} from './creator-outreach.js';
import {assessMarketplaceCandidate,assessObservedCreatorOutcome} from './creator-marketplace.js';
export type FreeCollaborationStage='draft'|'contact_proposed'|'negotiating_recorded'|'agreed_recorded'|
 'sample_planned'|'shipment_recorded'|'ugc_received'|'completed_recorded'|'cancelled';
export type FreeCampaignRecordKind='campaign'|'creator'|'collaboration'|'license'|'outcome'|'ad_study'|'creative_brief';
export const FREE_CAMPAIGN_RECORD_KINDS:readonly FreeCampaignRecordKind[]=
 ['campaign','creator','collaboration','license','outcome','ad_study','creative_brief'];
export type FreeCampaignRecord={id:string;kind:FreeCampaignRecordKind;brandId:string;campaignRef:string|null;
 payload:Readonly<Record<string,unknown>>;evidenceRefs:readonly string[];observedAt:string;
 status:'DRAFT_ONLY';externalActionAuthorized:false;moneyMovementAuthorized:false};
const good=(v:unknown)=>typeof v==='string'&&v.trim().length>0;
export function validateFreeCampaignRecord(record:FreeCampaignRecord):FreeCampaignRecord{
 if(!good(record.id)||!FREE_CAMPAIGN_RECORD_KINDS.includes(record.kind)||!good(record.brandId)||
  (record.campaignRef!==null&&!good(record.campaignRef)))throw Error('SOCIAL_FREE_RECORD_SCOPE_INVALID');
 if(!record.payload||typeof record.payload!=='object'||Array.isArray(record.payload))throw Error('SOCIAL_FREE_RECORD_PAYLOAD_INVALID');
 if(!Array.isArray(record.evidenceRefs)||!record.evidenceRefs.length||!record.evidenceRefs.every(good))
  throw Error('SOCIAL_FREE_RECORD_EVIDENCE_REQUIRED');
 if(!Number.isFinite(Date.parse(record.observedAt)))throw Error('SOCIAL_FREE_RECORD_DATE_INVALID');
 if(record.status!=='DRAFT_ONLY'||record.externalActionAuthorized!==false||record.moneyMovementAuthorized!==false)
  throw Error('SOCIAL_FREE_EXECUTION_FORBIDDEN');
 if(JSON.stringify(record.payload).length>12000)throw Error('SOCIAL_FREE_PAYLOAD_TOO_LARGE');
 const forbidden=['secret','password','apiKey','accessToken','refreshToken','privateKey','cardNumber'];
 if(Object.keys(record.payload).some(k=>forbidden.some(x=>x.toLowerCase()===k.toLowerCase())))
  throw Error('SOCIAL_FREE_SECRET_FIELD_FORBIDDEN');
 return Object.freeze({...record,evidenceRefs:Object.freeze([...record.evidenceRefs]),
  payload:Object.freeze({...record.payload})});
}
export type ImportedCreatorLead={platform:string;handle:string;nicheTags:readonly string[];
 productAffinitySignals:readonly string[];sourceRef:string;observedAt:string;
 contactPermission:'unknown'|'verified_opt_in'|'declined'|'do_not_contact';evidenceRefs:readonly string[]};
export function prepareManualCreatorImport(leads:readonly ImportedCreatorLead[],max=100){
 if(!leads.length||leads.length>max||max>100)throw Error('SOCIAL_FREE_IMPORT_LIMIT');
 const seen=new Set<string>(),clean:ImportedCreatorLead[]=[];
 for(const lead of leads){
  if(!['instagram','tiktok','youtube','facebook','email'].includes(lead.platform))throw Error('SOCIAL_FREE_PLATFORM_INVALID');
  const handle=lead.handle.trim().replace(/^@/,'').toLowerCase();
  if(!/^[a-z0-9._-]{2,80}$/.test(handle))throw Error('SOCIAL_FREE_HANDLE_INVALID');
  const key=lead.platform+':'+handle;
  if(seen.has(key))continue;
  seen.add(key);
  if(!good(lead.sourceRef)||!lead.evidenceRefs.length||!lead.evidenceRefs.every(good)||
   !Number.isFinite(Date.parse(lead.observedAt)))throw Error('SOCIAL_FREE_LEAD_EVIDENCE_REQUIRED');
  if(!['unknown','verified_opt_in','declined','do_not_contact'].includes(lead.contactPermission))
    throw Error('SOCIAL_FREE_PERMISSION_INVALID');
  clean.push(Object.freeze({...lead,handle,nicheTags:[...lead.nicheTags],productAffinitySignals:[...lead.productAffinitySignals],
   evidenceRefs:[...lead.evidenceRefs]}));
 }
 return Object.freeze(clean);
}
const allowed:Readonly<Record<FreeCollaborationStage,readonly FreeCollaborationStage[]>>={
 draft:['contact_proposed','cancelled'],
 contact_proposed:['negotiating_recorded','cancelled'],
 negotiating_recorded:['agreed_recorded','cancelled'],
 agreed_recorded:['sample_planned','ugc_received','cancelled'],
 sample_planned:['shipment_recorded','cancelled'],
 shipment_recorded:['ugc_received','cancelled'],
 ugc_received:['completed_recorded','cancelled'],
 completed_recorded:[],cancelled:[],
};
export function planCollaborationTransition(input:{from:FreeCollaborationStage;to:FreeCollaborationStage;
 evidenceRefs:readonly string[];source:'manual_record'|'verified_receipt'}) {
 if(!allowed[input.from]?.includes(input.to))throw Error('SOCIAL_FREE_INVALID_TRANSITION');
 if(!input.evidenceRefs.length||!input.evidenceRefs.every(good))throw Error('SOCIAL_FREE_TRANSITION_EVIDENCE_REQUIRED');
 // This labels an observation. It never performs an external action or grants approval.
 return Object.freeze({from:input.from,to:input.to,source:input.source,
  evidenceRefs:Object.freeze([...input.evidenceRefs]),externalActionAuthorized:false as const,
  authority:'OBSERVATION_ONLY' as const});
}
export function buildFreeOutreachDraft(input:{brief:CreatorCampaignBrief;candidate:CreatorCandidate;
 channel:string;productDescription:string;brandDisplayName:string;nowIso:string}){
 const score=assessMarketplaceCandidate(input.brief,input.candidate,input.nowIso);
 if(!score.eligibleForDraft||input.candidate.suppression!=='none'||!input.candidate.consentForOutreach)
  throw Error('SOCIAL_FREE_OUTREACH_NOT_ELIGIBLE');
 if(!good(input.productDescription)||!good(input.brandDisplayName))throw Error('SOCIAL_FREE_OUTREACH_CONTEXT_REQUIRED');
 if(input.channel!==input.candidate.evidence.platform)throw Error('SOCIAL_FREE_OUTREACH_CHANNEL_MISMATCH');
 const product=input.productDescription.trim(),brand=input.brandDisplayName.trim();
 // No hard-coded promises of free products or compensation: terms are not known.
 const text=`Hi! I'm reaching out for ${brand}. We liked your work around ${input.brief.nicheTags.join(', ')}. Would you be open to discussing a possible collaboration for ${product}? We can share details and compensation terms if you're interested. No pressure if it's not a fit.`;
 return Object.freeze({campaignId:input.brief.id,creatorRef:score.creatorRef,channel:input.channel,text,
  messageFingerprint:JSON.stringify({campaignId:input.brief.id,creatorRef:score.creatorRef,channel:input.channel,text}),
  evidenceRefs:score.fit.evidenceRefs,requiresOwnerApproval:true as const,sendAuthorized:false as const,
  authority:'OUTREACH_DRAFT_ONLY' as const});
}
/** Bridge to the canonical Growth outreach action proposal; STILL NO SEND. */
export function prepareCanonicalFreeCreatorTouch(input:{
 brief:CreatorCampaignBrief;candidate:CreatorCandidate;brandDisplayName:string;
 productDescription:string;brandVoiceProfileRef:string;channelVoiceProfileRef:string;
 createdAt:string;expiresAt:string;
}){
 const draft=buildFreeOutreachDraft({brief:input.brief,candidate:input.candidate,
  brandDisplayName:input.brandDisplayName,productDescription:input.productDescription,
  channel:input.candidate.evidence.platform,nowIso:input.createdAt});
 const plan:OutreachPlan={
  planId:'free-outreach:'+input.brief.id+':'+draft.creatorRef,
  campaignId:input.brief.id,creatorRef:draft.creatorRef,brandId:input.brief.brandId,
  channel:input.candidate.evidence.platform,offerRef:input.brief.offerRef,
  brandVoiceProfileRef:input.brandVoiceProfileRef,channelVoiceProfileRef:input.channelVoiceProfileRef,
  messageDraftRefs:['free-message:'+draft.messageFingerprint],
  eligibility:'eligible',eligibilityEvidenceRefs:input.candidate.evidence.evidenceRefs,
  maxTouches:1,stopState:'active',createdAt:input.createdAt,expiresAt:input.expiresAt,
 };
 const touch:OutreachTouchDraft={touchId:plan.planId+':touch:1',planId:plan.planId,ordinal:1,
  message:draft.text,valueAdd:'Optional collaboration terms available on request',status:'draft'};
 const proposal=prepareOutreachTouchProposal({plan,draft:touch,dueAt:input.createdAt});
 return Object.freeze({proposal,draft,sendAuthorized:false as const,
  approvalBoundary:'Social/Action Core' as const});
}
export function buildDirectorCreatorBrief(input:{campaignId:string;brandId:string;offerRef:string;creatorRef:string;
 format:'short_video'|'photo'|'carousel';disclosure:string;licenseRef?:string;evidenceRefs:readonly string[]}){
 if([input.campaignId,input.brandId,input.offerRef,input.creatorRef,input.disclosure].some(x=>!good(x))||
  !input.evidenceRefs.length)throw Error('SOCIAL_FREE_CREATIVE_BRIEF_INVALID');
 return Object.freeze({origin:'free-creator-collaboration' as const,...input,contentJob:'conversion' as const,
  directorTask:'Prepare a platform-native organic creative concept and a QC checklist. No invented endorsements or results.',
  qc:['creator attribution','accurate claims','material-connection disclosure','explicit rights review','owner approval'],
  mediaGenerated:false as const,publishAuthorized:false as const,authority:'DIRECTOR_BRIEF_ONLY' as const});
}
export function assessFreeCampaignReport(input:{brief:CreatorCampaignBrief;observations:readonly CreatorCampaignObservation[];
 organicViews:number|null;ugcPosts:number;licensedAssets:number}){
 if(!Number.isInteger(input.ugcPosts)||input.ugcPosts<0||!Number.isInteger(input.licensedAssets)||input.licensedAssets<0)
  throw Error('SOCIAL_FREE_COUNTS_INVALID');
 if(input.organicViews!==null&&(!Number.isInteger(input.organicViews)||input.organicViews<0))
  throw Error('SOCIAL_FREE_VIEWS_INVALID');
 // Distinct observations are explicit; never count a campaign twice by stacking snapshots.
 if(input.observations.length>1)throw Error('SOCIAL_FREE_OUTCOME_SNAPSHOT_AMBIGUOUS');
 const outcome=input.observations[0]?assessObservedCreatorOutcome(input.brief,input.observations[0]):null;
 return Object.freeze({campaignId:input.brief.id,ugcPosts:input.ugcPosts,licensedAssets:input.licensedAssets,
  organicViews:input.organicViews,profitAfterMarketingUsd:outcome?.netAfterMarketingUsd??null,
  cac:outcome&&outcome.economics.cac>0?outcome.economics.cac:null,
  scorecardState:outcome?'OBSERVED_COST_AND_SALES':'INSUFFICIENT_COMMERCIAL_EVIDENCE',
  scaleAuthorized:false as const,paidAdvertisingEnabled:false as const,authority:'REPORT_ONLY' as const});
}
export function buildUnpaidAdStudy(input:{brandId:string;campaignId:string;creativeRefs:readonly string[];
 destinationRef:string;hypothesis:string;organicEvidenceRefs:readonly string[]}) {
 if(!good(input.brandId)||!good(input.campaignId)||!good(input.destinationRef)||!good(input.hypothesis)||
  !input.creativeRefs.length||!input.organicEvidenceRefs.length)throw Error('SOCIAL_FREE_AD_STUDY_INVALID');
 return Object.freeze({...input,plannedSpendUsd:0 as const,impressionsPurchased:0 as const,
  channel:'ORGANIC_ONLY' as const,performance:'UNOBSERVED' as const,
  action:'Submit organic variants to existing Growth A/B assessment after verified observations',
  externalActionAuthorized:false as const,authority:'AD_STUDY_ONLY' as const});
}

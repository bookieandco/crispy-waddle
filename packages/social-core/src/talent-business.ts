export type TalentLifecycleState='EXPLORE'|'INCUBATE'|'EXPLOIT'|'RETEST'|'RETIRE';
export type MonetizationRail='platform-ads'|'affiliate'|'sponsorship'|'digital-product'|'pod'|'membership'|'service'|'lead-gen'|'licensing'|'client-ugc';

export interface TalentCommercialProfile {
  id:string; characterRef:string; audienceRefs:readonly string[];
  allowedRails:readonly MonetizationRail[]; sponsorCategories:readonly string[];
  prohibitedSponsorCategories:readonly string[]; ownedOfferRefs:readonly string[];
  disclosureRefs:readonly string[]; evidenceRefs:readonly string[];
}
export interface TalentRevenueEvent {id:string;characterRef:string;contentRef?:string;offerRef?:string;rail:MonetizationRail;amountUsd:number;occurredAt:string;evidenceRefs:readonly string[];}
export interface TalentCostEvent {id:string;characterRef:string;contentRef?:string;category:'generation'|'editing'|'voice'|'software'|'paid-media'|'human-review'|'other';amountUsd:number;occurredAt:string;evidenceRefs:readonly string[];}

export function calculateTalentPnl(characterRef:string,revenue:readonly TalentRevenueEvent[],costs:readonly TalentCostEvent[]){
  const revenueByRail:Record<string,number>={};let revenueUsd=0,costUsd=0;const evidence=new Set<string>();
  for(const event of revenue.filter(e=>e.characterRef===characterRef)){
    if(!Number.isFinite(event.amountUsd)||event.amountUsd<0||!event.evidenceRefs.length)throw new Error('SOCIAL_TALENT_REVENUE_INVALID');
    revenueUsd+=event.amountUsd;revenueByRail[event.rail]=(revenueByRail[event.rail]??0)+event.amountUsd;event.evidenceRefs.forEach(x=>evidence.add(x));
  }
  for(const event of costs.filter(e=>e.characterRef===characterRef)){
    if(!Number.isFinite(event.amountUsd)||event.amountUsd<0||!event.evidenceRefs.length)throw new Error('SOCIAL_TALENT_COST_INVALID');
    costUsd+=event.amountUsd;event.evidenceRefs.forEach(x=>evidence.add(x));
  }
  return Object.freeze({characterRef,revenueUsd,costUsd,contributionMarginUsd:revenueUsd-costUsd,revenueByRail:Object.freeze(revenueByRail),evidenceRefs:Object.freeze([...evidence]),authority:'SOCIAL_TALENT_PNL' as const});
}

export interface ContentAllocationPlan {more:number;better:number;new:number;lifecycle:TalentLifecycleState;evidenceRefs:readonly string[];}
export function validateContentAllocation(plan:ContentAllocationPlan):void{
  const values=[plan.more,plan.better,plan.new];
  if(values.some(v=>!Number.isFinite(v)||v<0||v>1))throw new Error('SOCIAL_TALENT_ALLOCATION_INVALID');
  if(Math.abs(values.reduce((a,b)=>a+b,0)-1)>1e-9)throw new Error('SOCIAL_TALENT_ALLOCATION_MUST_SUM_TO_ONE');
  if(!plan.evidenceRefs.length)throw new Error('SOCIAL_TALENT_ALLOCATION_EVIDENCE_REQUIRED');
}

export type AudienceInteractionKind='comment'|'dm'|'live-chat'|'profile-visit'|'link-click'|'product-question'|'service-question'|'cart'|'purchase';
export type AudienceIntent='none'|'informational'|'product'|'service'|'membership'|'affiliate'|'support'|'human-review';
export interface AudienceInteractionEvent {id:string;characterRef:string;accountRef:string;audienceRef:string;contentRef?:string;kind:AudienceInteractionKind;text?:string;occurredAt:string;observedFacts:Readonly<Record<string,string|number|boolean|null>>;evidenceRefs:readonly string[];}
export interface AudienceIntentObservation {interactionId:string;intent:AudienceIntent;confidence:number;evidenceRefs:readonly string[];}
export type AudienceRoute='follow'|'free-resource'|'owned-product'|'affiliate-offer'|'service-qualification'|'membership'|'support'|'human-review';

export function routeAudienceInteraction(
  event:AudienceInteractionEvent,
  intent:AudienceIntentObservation,
  policy:{minimumAutomationConfidence:number;allowAutomatedRoutes:readonly AudienceRoute[]},
){
  if(intent.interactionId!==event.id)throw new Error('SOCIAL_AUDIENCE_INTENT_INTERACTION_MISMATCH');
  if(!event.evidenceRefs.length||!intent.evidenceRefs.length)throw new Error('SOCIAL_AUDIENCE_EVIDENCE_REQUIRED');
  if(!Number.isFinite(intent.confidence)||intent.confidence<0||intent.confidence>1)throw new Error('SOCIAL_AUDIENCE_CONFIDENCE_INVALID');
  const route:AudienceRoute=intent.intent==='product'?'owned-product':intent.intent==='service'?'service-qualification':intent.intent==='membership'?'membership':intent.intent==='affiliate'?'affiliate-offer':intent.intent==='support'?'support':intent.intent==='human-review'?'human-review':intent.intent==='informational'?'free-resource':'follow';
  const automated=intent.confidence>=policy.minimumAutomationConfidence&&policy.allowAutomatedRoutes.includes(route)&&route!=='human-review';
  return Object.freeze({route,automated,reasons:Object.freeze([`intent=${intent.intent}`,`confidence=${intent.confidence.toFixed(3)}`,automated?'automation-admitted':'manual-or-nonautomated']),authority:'SOCIAL_AUDIENCE_ROUTE' as const});
}

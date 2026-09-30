import type { FanRecord, FanStage } from './domain.js';

export type FanOfferKind = 'capture'|'core'|'upsell'|'downsell'|'continuity'|'experience';

export interface FanOffer {
  id:string;
  kind:FanOfferKind;
  title:string;
  minimumStage:FanStage;
  priceMinor:number;
  currency:string;
  recurring:boolean;
  recurringValueStatement?:string;
  evidenceRefs:readonly string[];
}

export interface FanValueAssessment {
  fanId:string;
  relationshipScore:number;
  economicScore:number;
  advocacyScore:number;
  notes:readonly string[];
  authority:'ANALYSIS_ONLY';
}

export interface OfferEligibility {
  offerId:string;
  eligible:boolean;
  reasons:readonly string[];
  authority:'ANALYSIS_ONLY';
}

const STAGE_ORDER:readonly FanStage[]=[
  'VIEWER','FOLLOWER','RETURNER','LISTENER','DIRECT_FAN','COMMUNITY','BUYER','ADVOCATE',
];

export function assessFanValue(fan:FanRecord):FanValueAssessment{
  const stageIndex=STAGE_ORDER.indexOf(fan.stage);
  const relationshipScore=round(Math.min(1,(stageIndex/7)*0.4+Math.min(1,fan.repeatInteractions/10)*0.4+Math.min(1,fan.showsAttended/4)*0.2));
  const economicScore=round(Math.min(1,fan.purchases/5));
  const advocacyScore=round(Math.min(1,fan.advocacySignals/5));
  return Object.freeze({
    fanId:fan.id,
    relationshipScore,
    economicScore,
    advocacyScore,
    notes:Object.freeze([
      'Relationship value and economic value are intentionally separate.',
      'Low spending does not erase cultural or advocacy value.',
    ]),
    authority:'ANALYSIS_ONLY',
  });
}

export function assessOfferEligibility(fan:FanRecord, offer:FanOffer):OfferEligibility{
  if(!offer.id.trim()||!offer.title.trim())throw new Error('MUSIC_JUGGERNAUT_OFFER_ID_REQUIRED');
  if(!Number.isFinite(offer.priceMinor)||offer.priceMinor<0)throw new Error('MUSIC_JUGGERNAUT_OFFER_PRICE_INVALID');
  if(offer.recurring&&!offer.recurringValueStatement?.trim()){
    return Object.freeze({offerId:offer.id,eligible:false,reasons:Object.freeze(['Recurring charge requires a concrete recurring value statement.']),authority:'ANALYSIS_ONLY'});
  }
  const fanIndex=STAGE_ORDER.indexOf(fan.stage);
  const minimumIndex=STAGE_ORDER.indexOf(offer.minimumStage);
  const reasons:string[]=[];
  if(fanIndex<minimumIndex)reasons.push('Offer asks for more commitment than this relationship stage has earned.');
  if(offer.kind==='capture'&&fan.stage==='VIEWER'&&offer.priceMinor>0)reasons.push('Cold capture offers should not require a purchase.');
  return Object.freeze({
    offerId:offer.id,
    eligible:reasons.length===0,
    reasons:Object.freeze(reasons.length?reasons:['Offer commitment matches current fan relationship depth.']),
    authority:'ANALYSIS_ONLY',
  });
}

export function chooseRespectfulNextOffer(fan:FanRecord, offers:readonly FanOffer[]):FanOffer|undefined{
  return [...offers]
    .filter((offer)=>assessOfferEligibility(fan,offer).eligible)
    .sort((a,b)=>STAGE_ORDER.indexOf(a.minimumStage)-STAGE_ORDER.indexOf(b.minimumStage)||a.priceMinor-b.priceMinor)[0];
}
function round(value:number):number{return Math.round(value*10000)/10000;}

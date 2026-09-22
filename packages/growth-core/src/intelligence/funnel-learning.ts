import type { GrowthId } from '../domain/types.js';

function clean(value:string):string{return value.replace(/\s+/g,' ').trim()}
function tokens(value:string):Set<string>{
  return new Set(clean(value).toLowerCase().split(/[^a-z0-9]+/).filter(token=>token.length>2));
}
function similarity(a:string,b:string):number{
  const aa=tokens(a),bb=tokens(b);
  if(!aa.size&&!bb.size)return 1;
  const intersection=[...aa].filter(token=>bb.has(token)).length;
  return intersection/(new Set([...aa,...bb]).size||1);
}

export interface MessageMatchInput{
  adHeadline:string;
  adPromise:string;
  landingHeadline:string;
  landingLead:string;
  evidenceRefs:readonly string[];
}

export interface MessageMatchAssessment{
  headlineSimilarity:number;
  promiseSimilarity:number;
  score:number;
  status:'strong'|'review'|'weak';
  evidenceRefs:readonly string[];
}

export function assessAdLandingMessageMatch(input:MessageMatchInput):MessageMatchAssessment{
  if(!input.evidenceRefs.length)throw new Error('GROWTH_MESSAGE_MATCH_EVIDENCE_REQUIRED');
  const headlineSimilarity=similarity(input.adHeadline,input.landingHeadline);
  const promiseSimilarity=similarity(input.adPromise,input.landingLead);
  const score=headlineSimilarity*0.45+promiseSimilarity*0.55;
  return{
    headlineSimilarity,
    promiseSimilarity,
    score,
    status:score>=0.55?'strong':score>=0.25?'review':'weak',
    evidenceRefs:Object.freeze([...input.evidenceRefs]),
  };
}

export interface TrackingSignalInput{
  browserPurchaseEvents:number;
  serverPurchaseEvents:number;
  deduplicatedPurchases:number;
  actualOrders:number;
  eventIdsWithMatchKeys:number;
  totalEventIds:number;
}

export interface TrackingSignalAssessment{
  purchaseCoverage:number;
  duplicateControl:number;
  matchKeyCoverage:number;
  score:number;
  status:'healthy'|'review'|'insufficient';
  interpretation:string;
}

function ratio(n:number,d:number):number{return d>0?n/d:0}
function clamp(value:number):number{return Math.max(0,Math.min(1,value))}

export function assessTrackingSignalQuality(input:TrackingSignalInput):TrackingSignalAssessment{
  const actualOrders=Math.max(0,input.actualOrders);
  const purchaseCoverage=actualOrders>0?clamp(input.deduplicatedPurchases/actualOrders):0;
  const rawPurchaseEvents=Math.max(0,input.browserPurchaseEvents)+Math.max(0,input.serverPurchaseEvents);
  const duplicateControl=rawPurchaseEvents>0?clamp(input.deduplicatedPurchases/rawPurchaseEvents*2):0;
  const matchKeyCoverage=clamp(ratio(input.eventIdsWithMatchKeys,input.totalEventIds));
  const score=purchaseCoverage*0.5+duplicateControl*0.2+matchKeyCoverage*0.3;
  const status:TrackingSignalAssessment['status']=actualOrders===0?'insufficient':score>=0.8?'healthy':'review';
  return{
    purchaseCoverage,duplicateControl,matchKeyCoverage,score,status,
    interpretation:'Tracking quality is an input-quality diagnostic, not proof that higher match quality causes better ad performance.',
  };
}

export type CreativeTestAxis='net_new_concept'|'hook_variation'|'format_translation'|'commercial_context'|'landing_message';

export interface CreativeExperimentVariant{
  id:GrowthId;
  axis:CreativeTestAxis;
  controlId?:GrowthId;
  hypothesis:string;
  evidenceRefs:readonly string[];
}

export function createCreativeExperimentVariant(input:CreativeExperimentVariant):CreativeExperimentVariant{
  if(!input.id.trim()||!input.hypothesis.trim())throw new Error('GROWTH_CREATIVE_EXPERIMENT_FIELDS_REQUIRED');
  if(!input.evidenceRefs.length)throw new Error('GROWTH_CREATIVE_EXPERIMENT_EVIDENCE_REQUIRED');
  if(input.axis!=='net_new_concept'&&!input.controlId)throw new Error('GROWTH_CREATIVE_EXPERIMENT_CONTROL_REQUIRED');
  return Object.freeze({...input,evidenceRefs:Object.freeze([...input.evidenceRefs])});
}

export type RetargetingStepKind='objection_answer'|'proof'|'alternate_offer'|'value_audit';

export interface RetargetingStep{
  id:GrowthId;
  kind:RetargetingStepKind;
  hypothesis:string;
  evidenceRefs:readonly string[];
  offerId?:GrowthId;
  creativeAssetIds?:readonly GrowthId[];
}

export interface RetargetingSequence{
  id:GrowthId;
  sourceAudienceId:GrowthId;
  steps:readonly RetargetingStep[];
  authority:'PROPOSAL_ONLY';
}

export function createRetargetingSequence(input:{
  id:GrowthId;
  sourceAudienceId:GrowthId;
  steps:readonly RetargetingStep[];
}):RetargetingSequence{
  if(!input.id.trim()||!input.sourceAudienceId.trim()||!input.steps.length)throw new Error('GROWTH_RETARGETING_SEQUENCE_REQUIRED');
  for(const step of input.steps){
    if(!step.id.trim()||!step.hypothesis.trim()||!step.evidenceRefs.length)throw new Error('GROWTH_RETARGETING_STEP_EVIDENCE_REQUIRED');
    if(step.kind==='alternate_offer'&&!step.offerId)throw new Error('GROWTH_RETARGETING_ALTERNATE_OFFER_REQUIRED');
  }
  return Object.freeze({...input,steps:Object.freeze([...input.steps]),authority:'PROPOSAL_ONLY'});
}

export interface AcquisitionEconomicsInput{
  adSpend:number;
  newCustomers:number;
  grossRevenue:number;
  refunds:number;
  variableCosts:number;
  paymentFees?:number;
  fulfillmentCosts?:number;
  repeatRevenue?:number;
}

export interface AcquisitionEconomics{
  cac:number;
  netRevenue:number;
  contributionProfit:number;
  contributionRoas:number;
  mer:number;
  contributionPerNewCustomer:number;
  breakEvenCpa:number;
}

export function calculateAcquisitionEconomics(input:AcquisitionEconomicsInput):AcquisitionEconomics{
  const spend=Math.max(0,input.adSpend);
  const customers=Math.max(0,input.newCustomers);
  const gross=Math.max(0,input.grossRevenue)+Math.max(0,input.repeatRevenue??0);
  const refunds=Math.max(0,input.refunds);
  const costs=Math.max(0,input.variableCosts)+Math.max(0,input.paymentFees??0)+Math.max(0,input.fulfillmentCosts??0);
  const netRevenue=gross-refunds;
  const contributionBeforeAds=netRevenue-costs;
  const contributionProfit=contributionBeforeAds-spend;
  const contributionPerNewCustomer=customers>0?contributionBeforeAds/customers:0;
  return{
    cac:customers>0?spend/customers:0,
    netRevenue,
    contributionProfit,
    contributionRoas:spend>0?contributionBeforeAds/spend:0,
    mer:spend>0?gross/spend:0,
    contributionPerNewCustomer,
    breakEvenCpa:Math.max(0,contributionPerNewCustomer),
  };
}

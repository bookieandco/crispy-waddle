import { assessBreakoutReadiness, assessOfferStack, makeMusicMakeSenseAudit } from './career.js';
import { certifyMusicJuggernautCore } from './certification.js';
import type { CreativeOutlier, PerformanceObservation, PromotionBudget, RightsRecord } from './domain.js';
import { decideJuggernautAutonomy } from './governance.js';
import { chooseJuggernautMode, consolidateCreativeOutliers, decidePromotionSpend, detectCreativeOutlier } from './intelligence.js';
import { assessGuerrillaMusicOpportunity } from './playbook.js';

export const MUSIC_JUGGERNAUT_PRODUCTION_FINAL_VERSION='MUSIC-JUGGERNAUT.PRODUCTION.FINAL-v1' as const;

export interface PromotionTrafficQualityInput {
  exposures:number;
  clicks:number;
  songActions:number;
  repeatListeners:number;
  directFanCaptures:number;
  botRisk:number;
  attributionConfidence:number;
  evidenceRefs:readonly string[];
}

export interface PromotionTrafficQualityAssessment {
  status:'BLOCK'|'TESTABLE'|'TRUSTED';
  downstreamRate:number;
  reasonCodes:readonly string[];
  evidenceRefs:readonly string[];
  learningEligible:boolean;
  authority:'MEASUREMENT_ONLY';
}

export interface PaidScaleHealthInput {
  priorConversionRate:number;
  currentConversionRate:number;
  priorAcquisitionCostMinor:number;
  currentAcquisitionCostMinor:number;
  sampleSize:number;
  minimumSampleSize:number;
  evidenceRefs:readonly string[];
}

export interface PaidScaleHealthAssessment {
  action:'SCALE'|'HOLD'|'STOP';
  reasonCodes:readonly string[];
  evidenceRefs:readonly string[];
  authority:'BUDGET_RECOMMENDATION_ONLY';
  canIncreaseBudget:false;
}

export interface MusicJuggernautProductionFinalCertification {
  version:typeof MUSIC_JUGGERNAUT_PRODUCTION_FINAL_VERSION;
  passed:boolean;
  corePassed:boolean;
  checks:readonly {name:string;passed:boolean}[];
  authority:'CERTIFICATION_ONLY';
  externalActionsStarted:false;
}

export function assessPromotionTrafficQuality(input:PromotionTrafficQualityInput):PromotionTrafficQualityAssessment {
  for(const [field,value] of Object.entries({
    botRisk:input.botRisk,
    attributionConfidence:input.attributionConfidence,
  })) assertRate(value,field);
  for(const [field,value] of Object.entries({
    exposures:input.exposures,
    clicks:input.clicks,
    songActions:input.songActions,
    repeatListeners:input.repeatListeners,
    directFanCaptures:input.directFanCaptures,
  })) {
    if(!Number.isFinite(value)||value<0)throw new Error('MUSIC_PROMOTION_TRAFFIC_COUNT_INVALID:'+field);
  }
  const reasons:string[]=[];
  if(!input.evidenceRefs.length)reasons.push('PROMOTION_TRAFFIC_EVIDENCE_MISSING');
  if(input.botRisk>0.25)reasons.push('PROMOTION_TRAFFIC_BOT_RISK_HIGH');
  if(input.attributionConfidence<0.5)reasons.push('PROMOTION_ATTRIBUTION_CONFIDENCE_LOW');
  const downstream=input.songActions+input.repeatListeners+input.directFanCaptures;
  if(input.clicks>=50&&downstream===0)reasons.push('PROMOTION_TRAFFIC_NO_DOWNSTREAM_BEHAVIOR');
  if(input.exposures>=500&&input.clicks===0)reasons.push('PROMOTION_TRAFFIC_CLICK_SIGNAL_MISSING');
  const downstreamRate=round(input.clicks>0?downstream/input.clicks:0);
  const blocked=reasons.length>0;
  const trusted=!blocked&&input.attributionConfidence>=0.75&&input.botRisk<=0.1&&downstream>0;
  return Object.freeze({
    status:blocked?'BLOCK':trusted?'TRUSTED':'TESTABLE',
    downstreamRate,
    reasonCodes:Object.freeze(reasons),
    evidenceRefs:Object.freeze(unique(input.evidenceRefs)),
    learningEligible:!blocked&&downstream>0,
    authority:'MEASUREMENT_ONLY',
  });
}

export function assessPaidScaleHealth(input:PaidScaleHealthInput):PaidScaleHealthAssessment {
  assertRate(input.priorConversionRate,'priorConversionRate');
  assertRate(input.currentConversionRate,'currentConversionRate');
  if(!Number.isFinite(input.priorAcquisitionCostMinor)||input.priorAcquisitionCostMinor<=0)throw new Error('MUSIC_PAID_PRIOR_CAC_INVALID');
  if(!Number.isFinite(input.currentAcquisitionCostMinor)||input.currentAcquisitionCostMinor<=0)throw new Error('MUSIC_PAID_CURRENT_CAC_INVALID');
  if(!Number.isInteger(input.sampleSize)||input.sampleSize<0||!Number.isInteger(input.minimumSampleSize)||input.minimumSampleSize<1){
    throw new Error('MUSIC_PAID_SAMPLE_INVALID');
  }
  const reasons:string[]=[];
  let action:PaidScaleHealthAssessment['action']='SCALE';
  if(input.sampleSize<input.minimumSampleSize){
    action='HOLD';
    reasons.push('PAID_SCALE_SAMPLE_INSUFFICIENT');
  }else{
    const conversionRatio=input.priorConversionRate===0
      ? (input.currentConversionRate>0?1:0)
      : input.currentConversionRate/input.priorConversionRate;
    const cacRatio=input.currentAcquisitionCostMinor/input.priorAcquisitionCostMinor;
    if(conversionRatio<0.65||cacRatio>1.5){
      action='STOP';
      if(conversionRatio<0.65)reasons.push('PAID_SCALE_CONVERSION_DEGRADED');
      if(cacRatio>1.5)reasons.push('PAID_SCALE_CAC_DEGRADED');
    }else if(conversionRatio<0.9||cacRatio>1.2){
      action='HOLD';
      if(conversionRatio<0.9)reasons.push('PAID_SCALE_CONVERSION_SOFTENING');
      if(cacRatio>1.2)reasons.push('PAID_SCALE_CAC_SOFTENING');
    }
  }
  return Object.freeze({
    action,
    reasonCodes:Object.freeze(reasons),
    evidenceRefs:Object.freeze(unique(input.evidenceRefs)),
    authority:'BUDGET_RECOMMENDATION_ONLY',
    canIncreaseBudget:false,
  });
}

export function certifyMusicJuggernautProductionFinal():MusicJuggernautProductionFinalCertification {
  const core=certifyMusicJuggernautCore();
  const baseline={medianViews:800,medianSongActions:60,medianDirectFanCaptures:10,minimumExposures:500};

  const spike=detectCreativeOutlier(observation('spike-1',2400,300,70,0.02,0.95,['spike:1']),baseline);
  const goodA=detectCreativeOutlier(observation('good-a',2300,280,60,0.02,0.95,['good:a']),baseline);
  const goodB=detectCreativeOutlier(observation('good-b',2200,270,58,0.03,0.94,['good:b']),baseline);
  const replicated=consolidateCreativeOutliers([
    {...goodA,experimentId:'good-exp'},
    {...goodB,experimentId:'good-exp'},
  ])[0]!;

  const fakeA=detectCreativeOutlier(observation('fake-a',50000,2,0,0.96,0.12,['fake:a']),baseline);
  const fakeB=detectCreativeOutlier(observation('fake-b',52000,1,0,0.97,0.1,['fake:b']),baseline);
  const fakeConsolidated=consolidateCreativeOutliers([
    {...fakeA,experimentId:'fake-exp'},
    {...fakeB,experimentId:'fake-exp'},
  ])[0]!;

  const traffic=assessPromotionTrafficQuality({
    exposures:100000,clicks:2000,songActions:0,repeatListeners:0,directFanCaptures:0,
    botRisk:0.92,attributionConfidence:0.18,evidenceRefs:['traffic:suspicious'],
  });
  const paid=assessPaidScaleHealth({
    priorConversionRate:0.12,currentConversionRate:0.05,
    priorAcquisitionCostMinor:500,currentAcquisitionCostMinor:900,
    sampleSize:1000,minimumSampleSize:200,evidenceRefs:['paid:before','paid:after'],
  });
  const breakout=assessBreakoutReadiness({
    followupSongReady:false,contentInventory:2,directFanCaptureReady:false,rightsMapped:false,
    teamCapacity:true,liveProfileReady:false,catalogDepth:1,evidenceRefs:['breakout:weak'],
  });
  const guerrilla=assessGuerrillaMusicOpportunity({
    id:'g-bad',concept:'fake fan reaction',talkValue:0.9,artistFit:0.9,localFit:0.8,productionEase:0.8,
    permissionConfirmed:false,rightsClear:false,deceptive:true,spamRisk:0.9,evidenceRefs:['guerrilla:bad'],
  });
  const offers=assessOfferStack([
    {id:'free',kind:'ATTRACTION',description:'exclusive demo',targetStage:'FOLLOWER',recurring:false,recurringValueDefined:false},
    {id:'core',kind:'CORE',description:'show ticket',targetStage:'DIRECT_FAN',recurring:false,recurringValueDefined:false},
    {id:'club',kind:'CONTINUITY',description:'monthly fan club',targetStage:'COMMUNITY',recurring:true,recurringValueDefined:false},
  ]);
  const sense=makeMusicMakeSenseAudit({
    claim:'This campaign proves the song will scale.',
    evidenceRefs:['campaign:one'],
    sampleSize:12,
    attributionConfidence:0.3,
    hasReplication:false,
    hasContradictoryEvidence:true,
    spendDecision:true,
  });

  const budget:PromotionBudget={
    approvedMinor:100000,spentMinor:10000,experimentReserveMinor:20000,
    breakoutReserveMinor:40000,productionReserveMinor:30000,currency:'USD',
  };
  const blockedRights:RightsRecord={
    assetId:'song-blocked',masterOwnershipKnown:true,publishingKnown:true,
    sampleStatus:'blocked',thirdPartyUsageStatus:'none',evidenceRefs:['rights:blocked'],
  };
  const blockedSpend=decidePromotionSpend({
    budget,mode:'ATTACK',outlier:replicated,rights:blockedRights,requestedMinor:10000,preAuthorizedLimitMinor:15000,
  });
  const boundedSpend=decidePromotionSpend({
    budget,mode:'ATTACK',outlier:replicated,
    rights:{...blockedRights,assetId:'song-clear',sampleStatus:'none',evidenceRefs:['rights:clear']},
    requestedMinor:50000,preAuthorizedLimitMinor:15000,
  });
  const consequential=['public_publish','paid_publish','personal_fan_message','contract_sign','rights_grant','venue_commitment','budget_increase'] as const;
  const consequentialBlocked=consequential.every((action)=>!decideJuggernautAutonomy(action).allowedWithoutApproval);

  const checks=[
    {name:'core-certification',passed:core.passed},
    {name:'single-spike-stays-search',passed:spike.replicationCount===1&&chooseJuggernautMode({outliers:[spike]})==='SEARCH'},
    {name:'replicated-real-signal-opens-attack',passed:replicated.status==='validated'&&replicated.replicationCount>=2&&chooseJuggernautMode({outliers:[replicated]})==='ATTACK'},
    {name:'fake-viral-traffic-cannot-open-attack',passed:fakeConsolidated.status!=='validated'&&chooseJuggernautMode({outliers:[fakeConsolidated]})==='SEARCH'},
    {name:'opaque-traffic-blocked-from-learning',passed:traffic.status==='BLOCK'&&!traffic.learningEligible},
    {name:'paid-degradation-stops-scale',passed:paid.action==='STOP'&&paid.canIncreaseBudget===false},
    {name:'weak-breakout-readiness-blocks-escalation',passed:!breakout.ready&&breakout.blockers.length>=4},
    {name:'deceptive-guerrilla-tactic-blocked',passed:!guerrilla.eligible&&guerrilla.blockers.length>0},
    {name:'recurring-offer-requires-recurring-value',passed:!offers.valid&&offers.blockers.some((item)=>item.includes('Recurring charge'))},
    {name:'make-it-make-sense-rejects-weak-claim',passed:!sense.passes&&sense.concerns.length>=4},
    {name:'blocked-rights-stop-spend',passed:blockedSpend.action==='STOP'&&blockedSpend.authorizedMinor===0},
    {name:'preauthorization-ceiling-enforced',passed:boundedSpend.authorizedMinor===15000&&boundedSpend.requiresApproval},
    {name:'consequential-actions-remain-human-authorized',passed:consequentialBlocked},
  ] as const;

  return Object.freeze({
    version:MUSIC_JUGGERNAUT_PRODUCTION_FINAL_VERSION,
    passed:checks.every((check)=>check.passed),
    corePassed:core.passed,
    checks:Object.freeze(checks.map((check)=>Object.freeze({...check}))),
    authority:'CERTIFICATION_ONLY',
    externalActionsStarted:false,
  });
}

function observation(
  id:string,views:number,songActions:number,directFanCaptures:number,
  botRisk:number,attributionConfidence:number,evidenceRefs:readonly string[],
):PerformanceObservation{
  return {
    id,experimentId:id,exposures:Math.max(views,3000),views,shares:100,saves:120,comments:40,
    profileVisits:150,songActions,directFanCaptures,botRisk,attributionConfidence,
    observedAt:'2026-09-30T12:00:00.000Z',evidenceRefs,
  };
}
function assertRate(value:number,field:string):void{
  if(!Number.isFinite(value)||value<0||value>1)throw new Error('MUSIC_PRODUCTION_RATE_INVALID:'+field);
}
function unique(values:readonly string[]):string[]{return [...new Set(values.map((value)=>value.trim()).filter(Boolean))];}
function round(value:number):number{return Math.round(value*10000)/10000;}

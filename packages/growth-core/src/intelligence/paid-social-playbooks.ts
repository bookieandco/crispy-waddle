import type { GrowthId } from '../domain/types.js';
import { assertCommercialContext } from './creative-evidence-engine.js';

export type PaidSocialPlatform='meta'|'tiktok'|'reddit';
export type EvidenceState='insufficient'|'directional'|'decision_ready';

export interface SharedPerformanceInput{
  impressions:number;
  clicks:number;
  conversions:number;
  spend:number;
  contributionMargin:number;
  windowDays:number;
}

export interface ThresholdProfile{
  id:GrowthId;
  sourceRefs:readonly string[];
  minImpressions?:number;
  minClicks?:number;
  minConversions?:number;
  minWindowDays?:number;
  targetCpa?:number;
  minimumSpendMultipleOfTargetCpa?:number;
  minCtr?:number;
  minHookRate?:number;
  minHoldRate?:number;
}

function ratio(n:number,d:number):number{return d>0?n/d:0}
function safeMoney(v:number):number{return Number.isFinite(v)?Math.max(0,v):0}

export interface MetaCreativeInput extends SharedPerformanceInput{
  landingViews?:number;
  negativeFeedbackRate?:number;
  outboundClicks?:number;
}

export interface MetaCreativeDiagnostics{
  ctr:number;
  clickToConversionRate:number;
  cpc:number;
  cpa:number;
  contributionRoas:number;
  landingViewRate:number;
  userExperienceSignal:'unknown'|'healthy'|'watch';
  evidenceState:EvidenceState;
}

export function diagnoseMetaCreative(
  input:MetaCreativeInput,
  thresholds:ThresholdProfile,
):MetaCreativeDiagnostics{
  const clicks=Math.max(0,input.outboundClicks??input.clicks);
  const ctr=ratio(clicks,input.impressions);
  const clickToConversionRate=ratio(input.conversions,clicks);
  const cpc=ratio(safeMoney(input.spend),clicks);
  const cpa=ratio(safeMoney(input.spend),input.conversions);
  const contributionRoas=ratio(input.contributionMargin,safeMoney(input.spend));
  const landingViewRate=ratio(input.landingViews??0,clicks);
  const enoughWindow=input.windowDays>=(thresholds.minWindowDays??3);
  const enoughTraffic=input.impressions>=(thresholds.minImpressions??1000)||clicks>=(thresholds.minClicks??30);
  const enoughConversions=input.conversions>=(thresholds.minConversions??3);
  const evidenceState:EvidenceState=enoughWindow&&enoughTraffic&&enoughConversions?'decision_ready':
    enoughWindow&&enoughTraffic?'directional':'insufficient';
  const userExperienceSignal:MetaCreativeDiagnostics['userExperienceSignal']=
    input.negativeFeedbackRate===undefined?'unknown':input.negativeFeedbackRate<=0.01?'healthy':'watch';
  return{ctr,clickToConversionRate,cpc,cpa,contributionRoas,landingViewRate,userExperienceSignal,evidenceState};
}

export interface TikTokCreativeInput extends SharedPerformanceInput{
  twoSecondViews?:number;
  watchedToQuarter?:number;
  videoStarts?:number;
  averageWatchSeconds?:number;
  videoDurationSeconds?:number;
}

export interface TikTokCreativeDiagnostics{
  ctr:number;
  cpa:number;
  contributionRoas:number;
  twoSecondViewRate:number;
  quarterHoldRate:number;
  averageWatchShare:number;
  evidenceState:EvidenceState;
  action:'hold'|'iterate_creative'|'review_offer_or_landing'|'eligible_to_scale';
}

export function diagnoseTikTokCreative(
  input:TikTokCreativeInput,
  thresholds:ThresholdProfile,
):TikTokCreativeDiagnostics{
  const starts=Math.max(1,input.videoStarts??input.impressions);
  const ctr=ratio(input.clicks,input.impressions);
  const cpa=ratio(safeMoney(input.spend),input.conversions);
  const contributionRoas=ratio(input.contributionMargin,safeMoney(input.spend));
  const twoSecondViewRate=ratio(input.twoSecondViews??0,starts);
  const quarterHoldRate=ratio(input.watchedToQuarter??0,starts);
  const averageWatchShare=(input.averageWatchSeconds!==undefined&&input.videoDurationSeconds)
    ?ratio(input.averageWatchSeconds,input.videoDurationSeconds):0;
  const targetCpa=thresholds.targetCpa;
  const minimumSpend=targetCpa&&thresholds.minimumSpendMultipleOfTargetCpa
    ?targetCpa*thresholds.minimumSpendMultipleOfTargetCpa:undefined;
  const enoughSpend=minimumSpend===undefined||safeMoney(input.spend)>=minimumSpend;
  const enoughWindow=input.windowDays>=(thresholds.minWindowDays??1);
  const enoughTraffic=input.impressions>=(thresholds.minImpressions??1000);
  const enoughConversions=input.conversions>=(thresholds.minConversions??2);
  const evidenceState:EvidenceState=enoughSpend&&enoughWindow&&enoughTraffic&&enoughConversions?'decision_ready':
    enoughSpend&&enoughWindow&&enoughTraffic?'directional':'insufficient';

  let action:TikTokCreativeDiagnostics['action']='hold';
  if(evidenceState!=='insufficient'){
    const weakCtr=thresholds.minCtr!==undefined&&ctr<thresholds.minCtr;
    const weakHook=thresholds.minHookRate!==undefined&&twoSecondViewRate<thresholds.minHookRate;
    const weakHold=thresholds.minHoldRate!==undefined&&Math.max(quarterHoldRate,averageWatchShare)<thresholds.minHoldRate;
    if(weakCtr||weakHook||weakHold) action='iterate_creative';
    else if(input.conversions===0||targetCpa!==undefined&&cpa>targetCpa) action='review_offer_or_landing';
    else if(evidenceState==='decision_ready') action='eligible_to_scale';
  }
  return{ctr,cpa,contributionRoas,twoSecondViewRate,quarterHoldRate,averageWatchShare,evidenceState,action};
}

export type RedditTargetingMode='community'|'keyword'|'community_plus_keyword';

export interface RedditCommunityTarget{
  community:string;
  rationale:string;
  sourceRefs:readonly string[];
}

export interface RedditTargetingPlan{
  mode:RedditTargetingMode;
  communities:readonly RedditCommunityTarget[];
  keywords:readonly string[];
  excludedCommunities:readonly string[];
  conversionEvent:'purchase'|'lead'|'add_to_cart';
  nativeCreativeRequired:true;
}

export function createRedditTargetingPlan(input:{
  communities?:readonly RedditCommunityTarget[];
  keywords?:readonly string[];
  excludedCommunities?:readonly string[];
  conversionEvent?:'purchase'|'lead'|'add_to_cart';
}):RedditTargetingPlan{
  const communities=input.communities??[];
  const keywords=(input.keywords??[]).map(value=>value.trim()).filter(Boolean);
  if(!communities.length&&!keywords.length) throw new Error('GROWTH_REDDIT_TARGETING_SIGNAL_REQUIRED');
  for(const community of communities){
    if(!community.community.trim()||!community.rationale.trim()||!community.sourceRefs.length){
      throw new Error('GROWTH_REDDIT_COMMUNITY_EVIDENCE_REQUIRED');
    }
    assertCommercialContext(`${community.community} ${community.rationale}`);
  }
  for(const keyword of keywords) assertCommercialContext(keyword);
  const mode:RedditTargetingMode=communities.length&&keywords.length?'community_plus_keyword':communities.length?'community':'keyword';
  return{
    mode,
    communities:Object.freeze([...communities]),
    keywords:Object.freeze([...keywords]),
    excludedCommunities:Object.freeze([...(input.excludedCommunities??[])]),
    conversionEvent:input.conversionEvent??'purchase',
    nativeCreativeRequired:true,
  };
}

export interface RedditCreativeDiagnostics{
  ctr:number;
  cpa:number;
  contributionRoas:number;
  evidenceState:EvidenceState;
  recommendation:'hold'|'iterate_native_creative'|'review_targeting_or_offer'|'eligible_to_scale';
}

export function diagnoseRedditCreative(
  input:SharedPerformanceInput,
  thresholds:ThresholdProfile,
):RedditCreativeDiagnostics{
  const ctr=ratio(input.clicks,input.impressions);
  const cpa=ratio(safeMoney(input.spend),input.conversions);
  const contributionRoas=ratio(input.contributionMargin,safeMoney(input.spend));
  const enoughWindow=input.windowDays>=(thresholds.minWindowDays??3);
  const enoughTraffic=input.impressions>=(thresholds.minImpressions??500);
  const enoughConversions=input.conversions>=(thresholds.minConversions??2);
  const evidenceState:EvidenceState=enoughWindow&&enoughTraffic&&enoughConversions?'decision_ready':
    enoughWindow&&enoughTraffic?'directional':'insufficient';
  let recommendation:RedditCreativeDiagnostics['recommendation']='hold';
  if(evidenceState!=='insufficient'){
    if(thresholds.minCtr!==undefined&&ctr<thresholds.minCtr) recommendation='iterate_native_creative';
    else if(input.conversions===0||thresholds.targetCpa!==undefined&&cpa>thresholds.targetCpa) recommendation='review_targeting_or_offer';
    else if(evidenceState==='decision_ready') recommendation='eligible_to_scale';
  }
  return{ctr,cpa,contributionRoas,evidenceState,recommendation};
}

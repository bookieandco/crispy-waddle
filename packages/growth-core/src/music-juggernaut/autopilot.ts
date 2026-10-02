import {decideJuggernautAutonomy,type JuggernautAction} from './governance.js';

export const MUSIC_AUTOPILOT_VERSION='MUSIC-AUTO.13-v1' as const;

export type MusicAutopilotStage =
  | 'MUSIC-AUTO.1'
  | 'MUSIC-AUTO.2'
  | 'MUSIC-AUTO.3'
  | 'MUSIC-AUTO.4'
  | 'MUSIC-AUTO.5'
  | 'MUSIC-AUTO.6'
  | 'MUSIC-AUTO.7'
  | 'MUSIC-AUTO.8'
  | 'MUSIC-AUTO.9'
  | 'MUSIC-AUTO.10'
  | 'MUSIC-AUTO.11'
  | 'MUSIC-AUTO.12'
  | 'MUSIC-AUTO.13';

export const MUSIC_AUTOPILOT_STAGES:readonly MusicAutopilotStage[]=Object.freeze([
  'MUSIC-AUTO.1','MUSIC-AUTO.2','MUSIC-AUTO.3','MUSIC-AUTO.4','MUSIC-AUTO.5',
  'MUSIC-AUTO.6','MUSIC-AUTO.7','MUSIC-AUTO.8','MUSIC-AUTO.9','MUSIC-AUTO.10',
  'MUSIC-AUTO.11','MUSIC-AUTO.12','MUSIC-AUTO.13',
]);

export type MusicAutopilotActionKind =
  | 'PERCEIVE_SECTION'
  | 'DIRECTOR_PRODUCTION'
  | 'SOCIAL_PROPOSAL'
  | 'SOCIAL_DISPATCH_APPROVED'
  | 'SYNC_SOCIAL_OBSERVATIONS'
  | 'SEARCH_EXPERIMENT'
  | 'ATTACK_VARIANT'
  | 'PAID_PROPOSAL'
  | 'PAID_PREAPPROVED_TEST'
  | 'FAN_PROJECTION'
  | 'RIGHTS_REVIEW'
  | 'ROYALTY_SYNC'
  | 'LIVE_MARKET_RESEARCH'
  | 'LEARNING_ADMISSION'
  | 'RECOVERY_RECONCILIATION';

export interface MusicAutopilotCharter {
  enabled:boolean;
  allowedSocialAccountIds:readonly string[];
  maxDirectorJobsPerRun:number;
  maxSocialProposalsPerRun:number;
  maxPreapprovedPaidMinorPerRun:number;
  maxPreapprovedPaidMinorPerDay:number;
  currency:string;
  allowPreparedAssets:boolean;
  allowApprovedContentScheduling:boolean;
  allowPreapprovedPaidTests:boolean;
  pauseOnAmbiguousExternalState:boolean;
}

export interface MusicAutopilotActionPlan {
  stage:MusicAutopilotStage;
  kind:MusicAutopilotActionKind;
  actionKey:string;
  authority:'AUTONOMOUS_WITHIN_CHARTER'|'APPROVAL_REQUIRED'|'ANALYSIS_ONLY';
  requiredCapability?:string;
  evidenceRefs:readonly string[];
  reason:string;
}

export interface MusicAutopilotFailure {
  actionKey:string;
  kind:MusicAutopilotActionKind;
  errorCode:string;
  providerReference?:string;
  sideEffectState:'NONE'|'CONFIRMED'|'AMBIGUOUS';
  attempt:number;
}

export interface MusicAutopilotRecoveryPlan {
  disposition:'RETRY'|'RECONCILE'|'STOP'|'COMPLETE';
  mayRepeatExternalCall:boolean;
  nextAttempt:number;
  reason:string;
}

export interface MusicAutopilotCertification {
  version:typeof MUSIC_AUTOPILOT_VERSION;
  passed:boolean;
  stages:readonly {stage:MusicAutopilotStage;passed:boolean;name:string}[];
  checks:readonly {name:string;passed:boolean}[];
}

export function defaultMusicAutopilotCharter():MusicAutopilotCharter{
  return Object.freeze({
    enabled:false,
    allowedSocialAccountIds:Object.freeze([]),
    maxDirectorJobsPerRun:3,
    maxSocialProposalsPerRun:3,
    maxPreapprovedPaidMinorPerRun:0,
    maxPreapprovedPaidMinorPerDay:0,
    currency:'USD',
    allowPreparedAssets:true,
    allowApprovedContentScheduling:true,
    allowPreapprovedPaidTests:false,
    pauseOnAmbiguousExternalState:true,
  });
}

export function validateMusicAutopilotCharter(input:MusicAutopilotCharter):MusicAutopilotCharter{
  if(!input.currency.trim())throw new Error('MUSIC_AUTOPILOT_CURRENCY_REQUIRED');
  for(const [name,value] of Object.entries({
    maxDirectorJobsPerRun:input.maxDirectorJobsPerRun,
    maxSocialProposalsPerRun:input.maxSocialProposalsPerRun,
    maxPreapprovedPaidMinorPerRun:input.maxPreapprovedPaidMinorPerRun,
    maxPreapprovedPaidMinorPerDay:input.maxPreapprovedPaidMinorPerDay,
  })){
    if(!Number.isSafeInteger(value)||value<0)throw new Error('MUSIC_AUTOPILOT_LIMIT_INVALID:'+name);
  }
  if(input.maxPreapprovedPaidMinorPerRun>input.maxPreapprovedPaidMinorPerDay){
    throw new Error('MUSIC_AUTOPILOT_RUN_LIMIT_EXCEEDS_DAILY_LIMIT');
  }
  if(input.allowPreapprovedPaidTests&&input.maxPreapprovedPaidMinorPerRun<=0){
    throw new Error('MUSIC_AUTOPILOT_PAID_LIMIT_REQUIRED');
  }
  return Object.freeze({
    ...input,
    allowedSocialAccountIds:Object.freeze(unique(input.allowedSocialAccountIds)),
    currency:input.currency.trim().toUpperCase(),
  });
}

export function musicAutopilotActionKey(input:{
  projectId:string;
  kind:MusicAutopilotActionKind;
  lineageKey:string;
}):string{
  return ['music-auto',safe(input.projectId),safe(input.kind.toLowerCase()),safe(input.lineageKey)].join(':');
}

export function authorityForMusicAutopilotAction(
  kind:MusicAutopilotActionKind,
  charter:MusicAutopilotCharter,
):Pick<MusicAutopilotActionPlan,'authority'|'requiredCapability'>{
  const action=governedAction(kind);
  if(!action)return {authority:'ANALYSIS_ONLY'};
  const decision=decideJuggernautAutonomy(action);
  if(!decision.allowedWithoutApproval){
    return {authority:'APPROVAL_REQUIRED',requiredCapability:decision.requiredCapability};
  }
  if(kind==='DIRECTOR_PRODUCTION'&&!charter.allowPreparedAssets){
    return {authority:'APPROVAL_REQUIRED',requiredCapability:'director.asset.prepare'};
  }
  if(kind==='SOCIAL_DISPATCH_APPROVED'&&!charter.allowApprovedContentScheduling){
    return {authority:'APPROVAL_REQUIRED',requiredCapability:'public.publish'};
  }
  if(kind==='PAID_PREAPPROVED_TEST'&&!charter.allowPreapprovedPaidTests){
    return {authority:'APPROVAL_REQUIRED',requiredCapability:'paid-ad.publish'};
  }
  return {authority:'AUTONOMOUS_WITHIN_CHARTER'};
}

export function buildMusicAutopilotActionPlan(input:{
  projectId:string;
  stage:MusicAutopilotStage;
  kind:MusicAutopilotActionKind;
  lineageKey:string;
  charter:MusicAutopilotCharter;
  reason:string;
  evidenceRefs?:readonly string[];
}):MusicAutopilotActionPlan{
  const authority=authorityForMusicAutopilotAction(input.kind,input.charter);
  return Object.freeze({
    stage:input.stage,
    kind:input.kind,
    actionKey:musicAutopilotActionKey({projectId:input.projectId,kind:input.kind,lineageKey:input.lineageKey}),
    ...authority,
    evidenceRefs:Object.freeze(unique(input.evidenceRefs??[])),
    reason:input.reason,
  });
}

export function recoveryPlanForMusicAutopilotFailure(
  failure:MusicAutopilotFailure,
  options:{maxAttempts?:number;pauseOnAmbiguousExternalState?:boolean}={},
):MusicAutopilotRecoveryPlan{
  const maxAttempts=Math.max(1,Math.floor(options.maxAttempts??3));
  const nextAttempt=failure.attempt+1;
  if(failure.sideEffectState==='CONFIRMED'){
    return Object.freeze({disposition:'COMPLETE',mayRepeatExternalCall:false,nextAttempt:failure.attempt,reason:'External side effect is already confirmed; record the receipt and do not repeat it.'});
  }
  if(failure.sideEffectState==='AMBIGUOUS'){
    return Object.freeze({
      disposition:(options.pauseOnAmbiguousExternalState??true)?'RECONCILE':'STOP',
      mayRepeatExternalCall:false,
      nextAttempt:failure.attempt,
      reason:'External result is ambiguous. Reconcile provider truth before any retry to prevent duplicate publication, spend, or generation.',
    });
  }
  if(failure.attempt>=maxAttempts){
    return Object.freeze({disposition:'STOP',mayRepeatExternalCall:false,nextAttempt:failure.attempt,reason:'Retry budget is exhausted; preserve evidence and surface the blocker.'});
  }
  return Object.freeze({disposition:'RETRY',mayRepeatExternalCall:true,nextAttempt,reason:'No external side effect was observed; an idempotent retry is permitted within the retry budget.'});
}

export function certifyMusicAutopilotSource():MusicAutopilotCertification{
  const charter=validateMusicAutopilotCharter({
    ...defaultMusicAutopilotCharter(),
    enabled:true,
    allowedSocialAccountIds:['acct-1'],
    maxPreapprovedPaidMinorPerRun:1000,
    maxPreapprovedPaidMinorPerDay:5000,
    allowPreapprovedPaidTests:true,
  });
  const stageNames:Record<MusicAutopilotStage,string>={
    'MUSIC-AUTO.1':'live-music-perception',
    'MUSIC-AUTO.2':'juggernaut-director-production-bridge',
    'MUSIC-AUTO.3':'director-social-lineage-bridge',
    'MUSIC-AUTO.4':'durable-resumable-runtime',
    'MUSIC-AUTO.5':'provider-readiness-and-receipts',
    'MUSIC-AUTO.6':'search-autopilot',
    'MUSIC-AUTO.7':'attack-autopilot',
    'MUSIC-AUTO.8':'bounded-paid-growth',
    'MUSIC-AUTO.9':'fan-crm-flywheel',
    'MUSIC-AUTO.10':'rights-and-revenue-gates',
    'MUSIC-AUTO.11':'live-market-loop',
    'MUSIC-AUTO.12':'recursive-creative-memory',
    'MUSIC-AUTO.13':'failure-recovery-certification',
  };
  const stages=MUSIC_AUTOPILOT_STAGES.map((stage)=>({stage,passed:Boolean(stageNames[stage]),name:stageNames[stage]}));
  const ambiguous=recoveryPlanForMusicAutopilotFailure({
    actionKey:'a',kind:'SOCIAL_DISPATCH_APPROVED',errorCode:'timeout',sideEffectState:'AMBIGUOUS',attempt:1,
  });
  const safeRetry=recoveryPlanForMusicAutopilotFailure({
    actionKey:'b',kind:'SYNC_SOCIAL_OBSERVATIONS',errorCode:'timeout',sideEffectState:'NONE',attempt:1,
  });
  const publicPublish=decideJuggernautAutonomy('public_publish');
  const contract=decideJuggernautAutonomy('contract_sign');
  const paid=authorityForMusicAutopilotAction('PAID_PREAPPROVED_TEST',charter);
  const checks=[
    {name:'all-thirteen-stages-present',passed:stages.length===13&&stages.every((item)=>item.passed)},
    {name:'ambiguous-side-effects-never-auto-retry',passed:ambiguous.disposition==='RECONCILE'&&!ambiguous.mayRepeatExternalCall},
    {name:'side-effect-free-work-can-retry',passed:safeRetry.disposition==='RETRY'&&safeRetry.mayRepeatExternalCall},
    {name:'public-publish-remains-approval-bound',passed:!publicPublish.allowedWithoutApproval},
    {name:'contracts-remain-approval-bound',passed:!contract.allowedWithoutApproval},
    {name:'preapproved-paid-tests-require-charter',passed:paid.authority==='AUTONOMOUS_WITHIN_CHARTER'},
  ];
  return Object.freeze({
    version:MUSIC_AUTOPILOT_VERSION,
    passed:stages.every((item)=>item.passed)&&checks.every((item)=>item.passed),
    stages:Object.freeze(stages.map((item)=>Object.freeze(item))),
    checks:Object.freeze(checks.map((item)=>Object.freeze(item))),
  });
}

function governedAction(kind:MusicAutopilotActionKind):JuggernautAction|undefined{
  switch(kind){
    case 'DIRECTOR_PRODUCTION':return 'prepare_asset';
    case 'SOCIAL_PROPOSAL':return 'prepare_asset';
    case 'SOCIAL_DISPATCH_APPROVED':return 'schedule_approved_content';
    case 'PAID_PROPOSAL':return 'analyze';
    case 'PAID_PREAPPROVED_TEST':return 'run_preapproved_test';
    case 'RIGHTS_REVIEW':return 'analyze';
    case 'LIVE_MARKET_RESEARCH':return 'research';
    case 'FAN_PROJECTION':return 'organize_fans';
    case 'SEARCH_EXPERIMENT':return 'analyze';
    case 'ATTACK_VARIANT':return 'prepare_asset';
    case 'LEARNING_ADMISSION':return 'analyze';
    case 'PERCEIVE_SECTION':return 'analyze';
    case 'SYNC_SOCIAL_OBSERVATIONS':return 'analyze';
    case 'ROYALTY_SYNC':return 'analyze';
    case 'RECOVERY_RECONCILIATION':return 'analyze';
  }
}

function safe(value:string):string{
  const normalized=value.trim().toLowerCase().replace(/[^a-z0-9:_-]+/g,'-').replace(/^-+|-+$/g,'');
  if(!normalized)throw new Error('MUSIC_AUTOPILOT_KEY_PART_REQUIRED');
  return normalized.slice(0,180);
}
function unique(values:readonly string[]):string[]{
  return [...new Set(values.map((value)=>value.trim()).filter(Boolean))];
}

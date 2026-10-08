import {createHash} from 'node:crypto';

export const MONEY_STRATEGY_FACTORY_SCHEMA='MONEY-FINISH-11' as const;
type StrategyFamily='TREND'|'MEAN_REVERSION'|'BREAKOUT'|'OPTIONS_RISK'|'FX_SUPERVISED'|'FX_ANALOG';
type StrategyAsset='STOCK'|'FOREX'|'OPTIONS'|'METALS';
type Parameter=string|number|boolean;
const sha=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function ms(value:string,code:string):number {
  const stamp=Date.parse(value);
  if(!value||!Number.isFinite(stamp)||!/^\d{4}-\d{2}-\d{2}T/.test(value))throw new Error(code);
  return stamp;
}
function requireEvidence(refs:readonly string[],code:string):void {
  if(!refs.length||refs.some(x=>!x.trim())||new Set(refs).size!==refs.length)throw new Error(code);
}
function sortedParameters(raw:Readonly<Record<string,Parameter>>):Readonly<Record<string,Parameter>> {
  if(!Object.keys(raw).length||Object.keys(raw).length>64)throw new Error('MONEY_FACTORY_PARAMETERS_INVALID');
  return Object.freeze(Object.fromEntries(Object.entries(raw).sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>{
    if(!key.trim()||typeof value==='number'&&!Number.isFinite(value)||
       typeof value==='string'&&!value.trim())throw new Error('MONEY_FACTORY_PARAMETERS_INVALID');
    return [key,value];
  })));
}
export type MoneyStrategyCandidate=Readonly<{
  schemaVersion:typeof MONEY_STRATEGY_FACTORY_SCHEMA;
  candidateId:string;strategyFamily:StrategyFamily;asset:StrategyAsset;instrumentId:string;
  methodologyVersion:string;sourceSchema:string;sourceEvidenceIds:readonly string[];
  informationCutoff:string;createdAt:string;parameters:Readonly<Record<string,Parameter>>;
  maximumDevelopmentTrials:number;candidateHash:string;
  authority:'RESEARCH_ONLY';canExecute:false;canAuthorizeLive:false;
}>;
export function registerMoneyStrategy(input:Readonly<{
  candidateId:string;strategyFamily:StrategyFamily;asset:StrategyAsset;instrumentId:string;
  methodologyVersion:string;sourceSchema:string;sourceEvidenceIds:readonly string[];
  informationCutoff:string;createdAt:string;parameters:Readonly<Record<string,Parameter>>;
  maximumDevelopmentTrials:number;
}>):MoneyStrategyCandidate {
  if(!input.candidateId.trim()||!input.instrumentId.trim()||!input.methodologyVersion.trim()||
     !input.sourceSchema.trim()||!['TREND','MEAN_REVERSION','BREAKOUT','OPTIONS_RISK','FX_SUPERVISED','FX_ANALOG'].includes(input.strategyFamily)||
     !['STOCK','FOREX','OPTIONS','METALS'].includes(input.asset))
    throw new Error('MONEY_FACTORY_IDENTITY_REQUIRED');
  requireEvidence(input.sourceEvidenceIds,'MONEY_FACTORY_SOURCE_EVIDENCE_REQUIRED');
  if(ms(input.informationCutoff,'MONEY_FACTORY_CUTOFF_INVALID')>
     ms(input.createdAt,'MONEY_FACTORY_CREATED_INVALID'))throw new Error('MONEY_FACTORY_FUTURE_SOURCE');
  if(!Number.isSafeInteger(input.maximumDevelopmentTrials)||input.maximumDevelopmentTrials<1||
     input.maximumDevelopmentTrials>500)throw new Error('MONEY_FACTORY_TRIAL_BUDGET_INVALID');
  const canonical={...input,parameters:sortedParameters(input.parameters),
    sourceEvidenceIds:Object.freeze([...input.sourceEvidenceIds].sort())};
  const candidateHash=sha(canonical);
  return Object.freeze({schemaVersion:MONEY_STRATEGY_FACTORY_SCHEMA,...canonical,candidateHash,
    authority:'RESEARCH_ONLY',canExecute:false,canAuthorizeLive:false});
}
export function assertMoneyStrategyCandidate(candidate:MoneyStrategyCandidate):void {
  if(candidate.schemaVersion!==MONEY_STRATEGY_FACTORY_SCHEMA||candidate.authority!=='RESEARCH_ONLY'||
     candidate.canExecute!==false||candidate.canAuthorizeLive!==false)
    throw new Error('MONEY_FACTORY_CANDIDATE_AUTHORITY_INVALID');
  const expected=registerMoneyStrategy(candidate);
  if(expected.candidateHash!==candidate.candidateHash)throw new Error('MONEY_FACTORY_CANDIDATE_TAMPERED');
}
export type MoneyDevelopmentTrial=Readonly<{
  trialId:string;candidateId:string;candidateHash:string;datasetSnapshotHash:string;
  evaluatedAt:string;lastOutcomeAvailableAt:string;sampleSize:number;
  grossReturnBps:number;totalCostBps:number;netReturnBps:number;
  maxDrawdownBps:number;evidenceIds:readonly string[];
  datasetPartition:'DEVELOPMENT';
  authority:'RESEARCH_ONLY';canExecute:false;canAuthorizeLive:false;
}>;
export type MoneyHoldoutManifest=Readonly<{
  holdoutId:string;sourceSnapshotHash:string;caseIds:readonly string[];
  earliestDecisionAt:string;latestOutcomeAvailableAt:string;commitmentHash:string;
  embargoMs:number;authority:'LOCKBOX_METADATA_ONLY';
}>;
export type MoneyFrozenStrategy=Readonly<{
  freezeId:string;candidateId:string;candidateHash:string;
  frozenAt:string;trialIds:readonly string[];trialLedgerHash:string;
  holdoutId:string;holdoutCommitmentHash:string;
  predictions:readonly Readonly<{caseId:string;signal:-1|0|1}>[];
  predictionHash:string;
  authority:'LOCKED_RESEARCH_ONLY';canExecute:false;canAuthorizeLive:false;
}>;
export type MoneyHoldoutGrade=Readonly<{
  gradeId:string;candidateId:string;freezeId:string;holdoutId:string;
  sampleCount:number;netReturnBps:number;averageReturnBps:number;
  maxDrawdownBps:number;winRate:number;trialCount:number;
  multipleTestingWarning:boolean;
  proofStatus:'HISTORICAL_HOLDOUT_RESEARCH_ONLY';
  gradeHash:string;
  authority:'RESEARCH_ONLY';canExecute:false;canAuthorizeLive:false;
}>;
export type MoneyHoldoutCase=Readonly<{
  caseId:string;decisionAt:string;outcomeAt:string;outcomeAvailableAt:string;
  realizedReturnBps:number;oneWayCostBps:number;evidenceRef:string;
}>;
export class MoneyStrategyTrialLedger {
  readonly candidate:MoneyStrategyCandidate;
  #trials:MoneyDevelopmentTrial[]=[];
  #frozen:MoneyFrozenStrategy|null=null;
  constructor(candidate:MoneyStrategyCandidate){
    assertMoneyStrategyCandidate(candidate);
    this.candidate=candidate;
  }
  get trialCount():number{return this.#trials.length;}
  get frozen():boolean{return this.#frozen!==null;}
  appendDevelopmentTrial(input:Omit<MoneyDevelopmentTrial,'authority'|'canExecute'|'canAuthorizeLive'>):MoneyDevelopmentTrial {
    if(this.#frozen)throw new Error('MONEY_FACTORY_ALREADY_FROZEN');
    if(this.#trials.length>=this.candidate.maximumDevelopmentTrials)
      throw new Error('MONEY_FACTORY_TRIAL_BUDGET_EXHAUSTED');
    if(input.candidateId!==this.candidate.candidateId||
       input.candidateHash!==this.candidate.candidateHash||input.datasetPartition!=='DEVELOPMENT'||
       !input.trialId.trim()||!input.datasetSnapshotHash.trim()||
       this.#trials.some(x=>x.trialId===input.trialId))
      throw new Error('MONEY_FACTORY_TRIAL_IDENTITY_INVALID');
    requireEvidence(input.evidenceIds,'MONEY_FACTORY_TRIAL_EVIDENCE_REQUIRED');
    if(ms(input.lastOutcomeAvailableAt,'MONEY_FACTORY_TRIAL_OUTCOME_INVALID')>
       ms(input.evaluatedAt,'MONEY_FACTORY_TRIAL_EVALUATION_INVALID')||
       !Number.isSafeInteger(input.sampleSize)||input.sampleSize<1||
       [input.grossReturnBps,input.totalCostBps,input.netReturnBps,input.maxDrawdownBps].some(x=>!Number.isFinite(x))||
       input.totalCostBps<0||input.maxDrawdownBps<0||
       Math.abs(input.netReturnBps-(input.grossReturnBps-input.totalCostBps))>1e-8)
      throw new Error('MONEY_FACTORY_TRIAL_METRICS_INVALID');
    const row=Object.freeze({...input,evidenceIds:Object.freeze([...input.evidenceIds].sort()),
      authority:'RESEARCH_ONLY' as const,canExecute:false as const,canAuthorizeLive:false as const});
    this.#trials.push(row);
    return row;
  }
  freeze(input:Readonly<{
    frozenAt:string;manifest:MoneyHoldoutManifest;
    predictions:readonly Readonly<{caseId:string;signal:-1|0|1}>[];
  }>):MoneyFrozenStrategy {
    if(this.#frozen)throw new Error('MONEY_FACTORY_ALREADY_FROZEN');
    if(!this.#trials.length)throw new Error('MONEY_FACTORY_NO_DEVELOPMENT_EVIDENCE');
    const at=ms(input.frozenAt,'MONEY_FACTORY_FREEZE_TIME_INVALID');
    if(this.#trials.some(t=>ms(t.evaluatedAt,'MONEY_FACTORY_TRIAL_EVALUATION_INVALID')>at)||
       at>=ms(input.manifest.earliestDecisionAt,'MONEY_FACTORY_HOLDOUT_START_INVALID')||
       !input.manifest.commitmentHash.trim()||!input.manifest.holdoutId.trim()||
       !input.manifest.sourceSnapshotHash.trim()||
       input.manifest.authority!=='LOCKBOX_METADATA_ONLY')
      throw new Error('MONEY_FACTORY_HOLDOUT_NOT_PROSPECTIVELY_LOCKED');
    const predictionIds=new Set(input.predictions.map(p=>p.caseId));
    if(predictionIds.size!==input.manifest.caseIds.length ||
       input.predictions.length!==input.manifest.caseIds.length||
       input.predictions.some(p=> !input.manifest.caseIds.includes(p.caseId)||
          ![-1,0,1].includes(p.signal)))
      throw new Error('MONEY_FACTORY_HOLDOUT_PREDICTIONS_MISMATCH');
    const predictions=Object.freeze([...input.predictions].sort((a,b)=>a.caseId.localeCompare(b.caseId))
      .map(p=>Object.freeze({...p})));
    const trialIds=Object.freeze(this.#trials.map(t=>t.trialId));
    const trialLedgerHash=sha(this.#trials);
    const predictionHash=sha(predictions);
    const freezeId='money-freeze:'+sha({candidateHash:this.candidate.candidateHash,
      trialLedgerHash,holdout:input.manifest.commitmentHash,predictionHash,at});
    this.#frozen=Object.freeze({freezeId,candidateId:this.candidate.candidateId,
      candidateHash:this.candidate.candidateHash,frozenAt:input.frozenAt,trialIds,trialLedgerHash,
      holdoutId:input.manifest.holdoutId,holdoutCommitmentHash:input.manifest.commitmentHash,
      predictions,predictionHash,authority:'LOCKED_RESEARCH_ONLY',canExecute:false,canAuthorizeLive:false});
    return this.#frozen;
  }
}
// In-process research lockbox. This is NOT isolated persistent custody,
// institutional data governance, or an anti-peeking guarantee against process owners.
export class MoneyInProcessHoldoutLockbox {
  readonly manifest:MoneyHoldoutManifest;
  #rows:readonly MoneyHoldoutCase[];
  #consumed=false;
  constructor(input:Readonly<{
    holdoutId:string;sourceSnapshotHash:string;
    embargoMs:number;cases:readonly MoneyHoldoutCase[];
  }>){
    if(!input.holdoutId.trim()||!input.sourceSnapshotHash.trim()||!input.cases.length||
       !Number.isSafeInteger(input.embargoMs)||input.embargoMs<0)
      throw new Error('MONEY_FACTORY_HOLDOUT_MANIFEST_INVALID');
    const seen=new Set<string>();let previous=-Infinity;
    this.#rows=Object.freeze(input.cases.map(row=>{
      const d=ms(row.decisionAt,'MONEY_FACTORY_HOLDOUT_DECISION_INVALID');
      const o=ms(row.outcomeAt,'MONEY_FACTORY_HOLDOUT_OUTCOME_INVALID');
      const a=ms(row.outcomeAvailableAt,'MONEY_FACTORY_HOLDOUT_AVAILABLE_INVALID');
      if(!row.caseId.trim()||seen.has(row.caseId)||!row.evidenceRef.trim()||
         d<=previous||o<=d||a<o||!Number.isFinite(row.realizedReturnBps)||
         !Number.isFinite(row.oneWayCostBps)||row.oneWayCostBps<0)
        throw new Error('MONEY_FACTORY_HOLDOUT_ROW_INVALID');
      seen.add(row.caseId);previous=d;
      return Object.freeze({...row});
    }));
    const latest=Math.max(...this.#rows.map(r=>ms(r.outcomeAvailableAt,'MONEY_FACTORY_HOLDOUT_AVAILABLE_INVALID')));
    this.manifest=Object.freeze({holdoutId:input.holdoutId,sourceSnapshotHash:input.sourceSnapshotHash,
      caseIds:Object.freeze(this.#rows.map(r=>r.caseId)),
      earliestDecisionAt:this.#rows[0]!.decisionAt,
      latestOutcomeAvailableAt:new Date(latest).toISOString(),
      commitmentHash:sha({source:input.sourceSnapshotHash,rows:this.#rows,embargo:input.embargoMs}),
      embargoMs:input.embargoMs,authority:'LOCKBOX_METADATA_ONLY'});
  }
  get consumed():boolean{return this.#consumed;}
  evaluateOnce(frozen:MoneyFrozenStrategy,at:string):MoneyHoldoutGrade {
    if(this.#consumed)throw new Error('MONEY_FACTORY_HOLDOUT_ALREADY_CONSUMED');
    const unlock=ms(this.manifest.latestOutcomeAvailableAt,'MONEY_FACTORY_HOLDOUT_AVAILABLE_INVALID')+
      this.manifest.embargoMs;
    if(ms(at,'MONEY_FACTORY_HOLDOUT_EVALUATED_INVALID')<unlock)
      throw new Error('MONEY_FACTORY_HOLDOUT_EMBARGO_NOT_COMPLETE');
    if(frozen.authority!=='LOCKED_RESEARCH_ONLY'||frozen.canExecute!==false||
       frozen.canAuthorizeLive!==false||frozen.holdoutId!==this.manifest.holdoutId||
       frozen.holdoutCommitmentHash!==this.manifest.commitmentHash||
       !frozen.candidateId.trim()||!frozen.candidateHash.trim()||
       frozen.predictionHash!==sha(frozen.predictions)||
       frozen.predictions.length!==this.#rows.length||
       frozen.predictions.some(p=>!this.manifest.caseIds.includes(p.caseId)||
         ![-1,0,1].includes(p.signal))||
       ms(frozen.frozenAt,'MONEY_FACTORY_FREEZE_TIME_INVALID')>=
          ms(this.manifest.earliestDecisionAt,'MONEY_FACTORY_HOLDOUT_START_INVALID'))
      throw new Error('MONEY_FACTORY_HOLDOUT_FROZEN_PROOF_INVALID');
    const choices=new Map(frozen.predictions.map(p=>[p.caseId,p.signal]));
    if(choices.size!==this.#rows.length)throw new Error('MONEY_FACTORY_HOLDOUT_PREDICTION_ID_INVALID');
    const returns=this.#rows.map(row=>{
      const position=choices.get(row.caseId)!;
      return position*row.realizedReturnBps-Math.abs(position)*2*row.oneWayCostBps;
    });
    let equity=0,peak=0,maxDrawdownBps=0;
    for(const ret of returns){equity+=ret;peak=Math.max(peak,equity);
      maxDrawdownBps=Math.max(maxDrawdownBps,peak-equity);}
    const netReturnBps=returns.reduce((sum,n)=>sum+n,0);
    const receipt={candidateId:frozen.candidateId,freezeId:frozen.freezeId,
      holdoutId:this.manifest.holdoutId,sampleCount:this.#rows.length,
      netReturnBps,averageReturnBps:netReturnBps/this.#rows.length,
      maxDrawdownBps,winRate:returns.filter(x=>x>0).length/returns.length,
      trialCount:frozen.trialIds.length,multipleTestingWarning:frozen.trialIds.length>1};
    this.#consumed=true;
    return Object.freeze({...receipt,gradeId:'money-holdout:'+sha(receipt),
      proofStatus:'HISTORICAL_HOLDOUT_RESEARCH_ONLY',gradeHash:sha({
        ...receipt,source:this.manifest.commitmentHash,observedAt:at}),
      authority:'RESEARCH_ONLY',canExecute:false,canAuthorizeLive:false});
  }
}

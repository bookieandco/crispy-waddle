import {createHash} from 'node:crypto';
import {assertMoneyForwardGrade,MONEY_FORWARD_HORIZONS,type MoneyForwardGrade} from './money-finish-forward-grades.js';
import type {MoneyForwardJournalReadback,MoneyPaperCycleEvidence} from './money-finish-forward-journal.js';

export const MONEY_FINISH_FINAL_SCHEMA='MONEY-FINISH-15' as const;
const digest=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
function timestamp(v:string):number {
  const t=Date.parse(v);
  if(!v||!Number.isFinite(t))throw new Error('MONEY_FINAL_TIMESTAMP_INVALID');
  return t;
}
const isHash=(x:string)=>/^[0-9a-f]{64}$/i.test(x);
export type MoneyFinalProviderCanary=Readonly<{
  sourceId:string;observedAt:string;receivedAt:string;
  rightsReviewedAt:string;entitlementEvidenceId:string;
  independentSourceReceiptHash:string;
  sourceMode:'LICENSED_READ_ONLY'|'SYNTHETIC_FIXTURE';
  providerHostVerified:boolean;
}>;
export type MoneyFinalOriginalShadowRestore=Readonly<{
  originalPodId:string;originalVolumeId:string;
  originalBackupSnapshotId:string;sourceSnapshotSha256:string;
  encryptedBackupSha256:string;restoredBackupSha256:string;
  sourceRowCount:number;restoredRowCount:number;sourceHorizonCount:number;
  restoredHorizonCount:number;isolatedRestoreReceiptHash:string;
  sourceMachineEvidenceId:string;independentRestorerEvidenceId:string;
  recoveredAt:string;restoredAt:string;
}>;
export type MoneyFinalRuntimeManifest=Readonly<{
  paperOnly:true;liveOrdersDisabled:true;
  marketData:MoneyFinalProviderCanary|null;
  originalShadow:MoneyFinalOriginalShadowRestore|null;
  journal:MoneyForwardJournalReadback|null;
  journalLocation:'HOMEBASE_DURABLE_VOLUME'|'EPHEMERAL_TEST_RUNNER'|'NOT_AVAILABLE';
  journalIndependentReadbackEvidenceId:string|null;
  grades:readonly MoneyForwardGrade[];
  cycles:readonly MoneyPaperCycleEvidence[];
  observedAt:string;
}>;
export type MoneyFinalIntegrationManifest=Readonly<{
  expectedHeadSha:string;mainHeadSha:string;
  mergedPullRequests:readonly number[];
  rootCiHeadSha:string;rootCiRunId:string;rootCiConclusion:'success'|'failure'|'pending'|'unknown';
  compilationReceiptHash:string|null;
}>;
export type MoneyFinalEngineeringGate=Readonly<{
  schemaVersion:typeof MONEY_FINISH_FINAL_SCHEMA;
  assessmentId:string;assessedAt:string;
  readiness:'BLOCKED'|'EXTERNAL_REVIEW_REQUIRED';
  finalCertification:'NOT_ISSUED';
  reasonCodes:readonly string[];
  coverage:readonly string[];
  evidenceHash:string;
  financialAuthority:'NONE';canExecute:false;canAuthorizeLive:false;
}>;
const requiredPrs=Object.freeze([1170,1171,1173,1174,1175] as const);
export function assessMoneyFinishFinal(input:Readonly<{
  integration:MoneyFinalIntegrationManifest;runtime:MoneyFinalRuntimeManifest;
  assessedAt:string;minimumCycles:number;maximumHeartbeatGapMs:number;
  maximumEvidenceAgeMs:number;
}>):MoneyFinalEngineeringGate {
  const at=timestamp(input.assessedAt),now=timestamp(input.runtime.observedAt);
  if(!Number.isSafeInteger(input.minimumCycles)||input.minimumCycles<3||
    !Number.isSafeInteger(input.maximumHeartbeatGapMs)||input.maximumHeartbeatGapMs<=0||
    !Number.isSafeInteger(input.maximumEvidenceAgeMs)||input.maximumEvidenceAgeMs<=0)
    throw new Error('MONEY_FINAL_POLICY_INVALID');
  if(now>at)throw new Error('MONEY_FINAL_FUTURE_MANIFEST');
  const failures:string[]=[];
  const {integration:i,runtime:r}=input;
  if(!/^[0-9a-f]{40}$/i.test(i.expectedHeadSha)||i.mainHeadSha!==i.expectedHeadSha||
     i.rootCiHeadSha!==i.expectedHeadSha||i.rootCiConclusion!=='success'||
     !i.rootCiRunId.trim()||!i.compilationReceiptHash||!isHash(i.compilationReceiptHash)||
     requiredPrs.some(p=>!i.mergedPullRequests.includes(p)))
    failures.push('EXACT_MAIN_HEAD_AND_STACKED_CI_UNVERIFIED');
  if(!r.paperOnly||!r.liveOrdersDisabled)failures.push('LIVE_EXECUTION_BOUNDARY_UNVERIFIED');
  if(at-now>input.maximumEvidenceAgeMs)failures.push('RUNTIME_MANIFEST_STALE');
  if(!r.marketData||r.marketData.sourceMode!=='LICENSED_READ_ONLY'||
     !r.marketData.providerHostVerified||
     !r.marketData.sourceId.trim()||!r.marketData.entitlementEvidenceId.trim()||
     !isHash(r.marketData.independentSourceReceiptHash))
    failures.push('LICENSED_LIVE_READONLY_PROVIDER_UNVERIFIED');
  else {
    const observed=timestamp(r.marketData.observedAt),received=timestamp(r.marketData.receivedAt);
    const rights=timestamp(r.marketData.rightsReviewedAt);
    if(rights>observed||observed>received||received>now||
       now-received>input.maximumEvidenceAgeMs)
      failures.push('MARKET_CANARY_TIME_OR_RIGHTS_INVALID');
  }
  const restore=r.originalShadow;
  if(!restore||!restore.originalPodId.trim()||!restore.originalVolumeId.trim()||
    !restore.originalBackupSnapshotId.trim()||!restore.sourceMachineEvidenceId.trim()||
    !restore.independentRestorerEvidenceId.trim()||
    restore.independentRestorerEvidenceId===restore.sourceMachineEvidenceId||
    !isHash(restore.sourceSnapshotSha256)||
    !isHash(restore.encryptedBackupSha256)||!isHash(restore.restoredBackupSha256)||
    !isHash(restore.isolatedRestoreReceiptHash)||
    restore.encryptedBackupSha256!==restore.restoredBackupSha256||
    !Number.isSafeInteger(restore.sourceRowCount)||restore.sourceRowCount<=0||
    restore.restoredRowCount!==restore.sourceRowCount||
    !Number.isSafeInteger(restore.sourceHorizonCount)||restore.sourceHorizonCount<=0||
    restore.sourceHorizonCount!==restore.restoredHorizonCount)
    failures.push('ORIGINAL_SHADOW_ISOLATED_RESTORE_NOT_PROVEN');
  else if(timestamp(restore.recoveredAt)>timestamp(restore.restoredAt)||
          timestamp(restore.restoredAt)>now)
    failures.push('ORIGINAL_SHADOW_RESTORE_CHRONOLOGY_INVALID');
  const journal=r.journal;
  if(!journal||journal.integrity!=='HASH_CHAIN_VERIFIED'||
     r.journalLocation!=='HOMEBASE_DURABLE_VOLUME'||
     !r.journalIndependentReadbackEvidenceId?.trim()||
     !journal.tailHash.trim()||!journal.count||
     journal.count!==r.grades.length||
     journal.gradeIds.length!==r.grades.length||
     journal.eventHashes.length!==r.grades.length||
     journal.gradeIds.some((id,index)=>id!==r.grades[index]?.gradeId))
    failures.push('INDEPENDENT_DURABLE_JOURNAL_READBACK_MISSING');
  const gradeKeys=new Set<string>(),coverage=new Set<string>();
  for(const grade of r.grades){
    try{assertMoneyForwardGrade(grade);}
    catch{failures.push('INVALID_FORWARD_GRADE_PROVENANCE');continue;}
    const key=grade.predictionId+'|'+grade.horizon;
    if(gradeKeys.has(key))failures.push('DUPLICATE_HORIZON_GRADE');
    gradeKeys.add(key);coverage.add(grade.horizon);
    if(timestamp(grade.gradedAt)>now)failures.push('FUTURE_FORWARD_GRADE');
  }
  for(const horizon of MONEY_FORWARD_HORIZONS)
    if(!coverage.has(horizon))failures.push('MISSING_FORWARD_HORIZON_'+horizon.toUpperCase());
  if(r.cycles.length<input.minimumCycles)failures.push('MULTICYCLE_WATCHDOG_NOT_PROVEN');
  let lastTime=-Infinity,lastCount=0;
  const cycleIds=new Set<string>();
  for(const c of r.cycles){
    const t=timestamp(c.completedAt);
    if(cycleIds.has(c.cycleId)||!c.cycleId.trim()||
       t<=lastTime||t>now||(lastTime!==-Infinity&&t-lastTime>input.maximumHeartbeatGapMs)||
       c.journalCount<=lastCount||
       !journal||c.journalCount>journal.count||
       journal.eventHashes[c.journalCount-1]!==c.journalTailHash)
      failures.push('WATCHDOG_CYCLE_ORDER_OR_READBACK_INVALID');
    if(c.realFeedOrigin!=='LICENSED_READ_ONLY'||!c.isolatedIndependentReadback||
       c.evidenceIds.length<1)failures.push('SYNTHETIC_OR_UNVERIFIED_WATCHDOG_CYCLE');
    lastTime=t;lastCount=c.journalCount;cycleIds.add(c.cycleId);
  }
  if(journal&&(r.cycles.at(-1)?.journalCount!==journal.count||
     r.cycles.at(-1)?.journalTailHash!==journal.tailHash))
    failures.push('FINAL_JOURNAL_TAIL_NOT_RECONCILED');
  if(r.grades.length>0&&r.grades.every(g=>g.netReturnBps===0))
    failures.push('NO_DIRECTIONAL_FORWARD_PAPER_RESULTS');
  const reasonCodes=Object.freeze([...new Set(failures)].sort());
  const receipt={schemaVersion:MONEY_FINISH_FINAL_SCHEMA,assessedAt:input.assessedAt,
    readiness:reasonCodes.length?'BLOCKED' as const:'EXTERNAL_REVIEW_REQUIRED' as const,
    finalCertification:'NOT_ISSUED' as const,reasonCodes,
    coverage:Object.freeze([...coverage].sort()),
    evidenceHash:digest({integration:i,runtime:{...r,grades:r.grades.map(g=>g.gradeHash)},at}),
    financialAuthority:'NONE' as const,canExecute:false as const,canAuthorizeLive:false as const};
  return Object.freeze({...receipt,assessmentId:'money-final:'+digest(receipt)});
}

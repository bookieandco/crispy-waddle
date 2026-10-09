import {createHash} from 'node:crypto';
import {assertMoneyForwardGrade,MONEY_FORWARD_HORIZONS,type MoneyForwardGrade} from './money-finish-forward-grades.js';
import type {MoneyForwardJournalReadback,MoneyPaperCycleEvidence} from './money-finish-forward-journal.js';

/**
 * A separate NEW forward-only paper lineage; never an alias for original Shadow
 * history, restored SWLC records or existing production certification.
 */
export const MONEY_FORWARD_ONLY_SCHEMA='MONEY-FORWARD-ONLY-COMMISSION.1' as const;
export type MoneyForwardOnlyAsset='STOCK'|'FOREX'|'OPTIONS'|'METALS';
export type MoneyForwardOnlyFeed=Readonly<{
  asset:MoneyForwardOnlyAsset;providerId:string;entitlementEvidenceId:string;
  receivedAt:string;availableAt:string;observedAt:string;observationEvidenceId:string;
  origin:'LICENSED_READ_ONLY'|'SYNTHETIC_FIXTURE'|'UNVERIFIED';
  settlementAndAdjustmentsVerified:boolean;
}>;
export type MoneyPortableProof=Readonly<{
  expectedMainSha:string;deployedSha:string;
  deployedEnvironment:'production'|'preview'|'local';
  memoryProvider:'PORTABLE_OIDC_POSTGRES'|'HOMEBASE_POSTGRES'|'SWLC_SUPABASE'|'IN_MEMORY';
  gatewayHealthStatus:200|500|503|0;
  persistentHostEvidenceId:string;
  verifiedHostMountId:string;
  restartReadbackEvidenceId:string;
  emptyNewJournalReadbackId:string;
  separateForwardNamespaceId:string;
  swlcAuditIssueId:string;
  supabaseMode:'DEFERRED_AUDIT_REPAIR';
}>;
export type MoneyForwardOnlyCommissionAssessment=Readonly<{
  schemaVersion:typeof MONEY_FORWARD_ONLY_SCHEMA;
  lineage:'NEW_FORWARD_ONLY_NO_HISTORICAL_RESTORE';
  state:'BLOCKED'|'COLLECTOR_REVIEW_REQUIRED'|'PAPER_EVIDENCE_REVIEW_REQUIRED';
  reasonCodes:readonly string[];
  horizonCoverage:readonly string[];
  cycleCount:number;
  assessmentHash:string;
  originalShadowRecovered:false;
  historicalPerformanceCertified:false;
  unattendedPaperCertified:false;
  finalCertification:'NOT_ISSUED';
  authority:'RESEARCH_ONLY';canExecute:false;canAuthorizeLive:false;
}>;
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const t=(x:string)=>{const n=Date.parse(x);if(!x||!Number.isFinite(n))throw new Error('MONEY_FORWARD_ONLY_TIMESTAMP_INVALID');return n;};
const present=(v:string)=>typeof v==='string'&&v.trim().length>0;
const isSha=(x:string)=>/^[a-f0-9]{40}$/i.test(x);

export function assessNewMoneyForwardOnly(input:Readonly<{
  asOf:string;lineageStartAt:string;
  runtime:MoneyPortableProof;feeds:readonly MoneyForwardOnlyFeed[];
  grades:readonly MoneyForwardGrade[];
  journal:MoneyForwardJournalReadback|null;
  cycles:readonly MoneyPaperCycleEvidence[];
  priorShadowRowsImported:boolean;
  liveOrdersDisabled:boolean;
}>):MoneyForwardOnlyCommissionAssessment {
  const asOf=t(input.asOf),start=t(input.lineageStartAt);
  if(start>asOf)throw new Error('MONEY_FORWARD_ONLY_START_IN_FUTURE');
  const errors:string[]=[];
  const r=input.runtime;
  if(r.supabaseMode!=='DEFERRED_AUDIT_REPAIR'||r.swlcAuditIssueId!=='1110')
    errors.push('SWLC_DEFERRAL_NOT_EXPLICIT');
  if(!isSha(r.expectedMainSha)||r.expectedMainSha!==r.deployedSha||
     r.deployedEnvironment!=='production')
    errors.push('EXACT_MAIN_NOT_DEPLOYED');
  if(!['PORTABLE_OIDC_POSTGRES','HOMEBASE_POSTGRES'].includes(r.memoryProvider)||
     r.gatewayHealthStatus!==200)
    errors.push('INDEPENDENT_DURABLE_MEMORY_NOT_PROVEN');
  if(!present(r.persistentHostEvidenceId)||!present(r.verifiedHostMountId)||
     !present(r.restartReadbackEvidenceId)||!present(r.emptyNewJournalReadbackId)||
     !present(r.separateForwardNamespaceId))
    errors.push('PERSISTENT_HOST_AND_FRESH_JOURNAL_UNVERIFIED');
  if(input.priorShadowRowsImported)
    errors.push('OLD_SHADOW_HISTORY_MUST_NOT_MIX_WITH_NEW_FORWARD_ONLY');
  if(!input.liveOrdersDisabled)
    errors.push('LIVE_ORDER_AUTHORITY_NOT_DENIED');
  const seen=new Set<string>();
  for(const f of input.feeds) {
    if(seen.has(f.asset))errors.push('DUPLICATE_ASSET_FEED:'+f.asset);
    seen.add(f.asset);
    if(!present(f.providerId)||!present(f.entitlementEvidenceId)||!present(f.observationEvidenceId)||
       f.origin!=='LICENSED_READ_ONLY')
      errors.push('LICENSED_PROVIDER_NOT_VERIFIED:'+f.asset);
    try{
      const o=t(f.observedAt),a=t(f.availableAt),rcv=t(f.receivedAt);
      if(o>a||a>rcv||rcv>asOf||rcv<start)errors.push('FEED_NOT_POINT_IN_TIME:'+f.asset);
    }catch {errors.push('FEED_TIME_INVALID:'+f.asset);}
    if(f.asset==='OPTIONS'&&!f.settlementAndAdjustmentsVerified)
      errors.push('OPTION_CONTRACT_TERMS_UNVERIFIED');
  }
  for(const asset of ['STOCK','FOREX','OPTIONS','METALS'] as const)
    if(!seen.has(asset))errors.push('REQUIRED_FEED_MISSING:'+asset);

  if(input.grades.length>0) {
    if(!input.journal||input.journal.integrity!=='HASH_CHAIN_VERIFIED'||
       input.journal.count!==input.grades.length||
       input.journal.gradeIds.length!==input.grades.length||
       input.journal.eventHashes.length!==input.grades.length)
      errors.push('FORWARD_JOURNAL_INDEPENDENT_READBACK_MISSING');
    const gradeKeys=new Set<string>();
    for(let i=0;i<input.grades.length;i++){
      const g=input.grades[i]!;
      assertMoneyForwardGrade(g);
      if(t(g.dueAt)<start||t(g.gradedAt)>asOf)
        errors.push('GRADE_OUTSIDE_NEW_FORWARD_LINEAGE');
      const id=g.predictionId+'|'+g.horizon;
      if(gradeKeys.has(id))errors.push('DUPLICATED_PROSPECTIVE_GRADE');
      gradeKeys.add(id);
      if(input.journal&&input.journal.gradeIds[i]!==g.gradeId)
        errors.push('JOURNAL_GRADE_ID_NOT_RECONCILED');
    }
  } else if(input.journal?.count) {
    errors.push('JOURNAL_HAS_UNDISCLOSED_GRADES');
  }
  const coverage=Object.freeze([...new Set(input.grades.map(g=>g.horizon))].sort());
  // Missing immature horizons are explicit *pending* outcomes, not failures or fake labels.
  const expected=[...MONEY_FORWARD_HORIZONS];
  const completeHorizonCoverage=expected.every(x=>coverage.includes(x));
  if(input.cycles.length&&!input.journal)
    errors.push('CYCLES_WITHOUT_JOURNAL');
  let priorAt=-Infinity,priorCount=0;const cycleIds=new Set<string>();
  for(const c of input.cycles){
    let when=NaN;
    try{when=t(c.completedAt);}catch{/* fail closed below */}
    if(!present(c.cycleId)||cycleIds.has(c.cycleId)||!Number.isFinite(when)||
       when<=priorAt||when>asOf||
       c.realFeedOrigin!=='LICENSED_READ_ONLY'||!c.isolatedIndependentReadback||
       !c.evidenceIds.length||!Number.isSafeInteger(c.journalCount)||
       c.journalCount<=priorCount||!input.journal||
       c.journalCount>input.journal.count||
       input.journal.eventHashes[c.journalCount-1]!==c.journalTailHash)
      errors.push('PAPER_WATCHDOG_NOT_REAL_OR_ADVANCING');
    cycleIds.add(c.cycleId);priorAt=when;priorCount=c.journalCount;
  }
  if(input.cycles.length>=3&&input.journal&&
     (input.cycles.at(-1)?.journalCount!==input.journal.count||
      input.cycles.at(-1)?.journalTailHash!==input.journal.tailHash))
    errors.push('LATEST_PAPER_CYCLE_NOT_RECONCILED');
  const state=errors.length?'BLOCKED':
    completeHorizonCoverage&&input.cycles.length>=3?'PAPER_EVIDENCE_REVIEW_REQUIRED':
    'COLLECTOR_REVIEW_REQUIRED';
  const reasonCodes=Object.freeze([...new Set(errors)].sort());
  const payload={schemaVersion:MONEY_FORWARD_ONLY_SCHEMA,
    lineage:'NEW_FORWARD_ONLY_NO_HISTORICAL_RESTORE' as const,state,reasonCodes,
    horizonCoverage:coverage,cycleCount:input.cycles.length,originalShadowRecovered:false as const,
    historicalPerformanceCertified:false as const,unattendedPaperCertified:false as const,
    finalCertification:'NOT_ISSUED' as const,authority:'RESEARCH_ONLY' as const,
    canExecute:false as const,canAuthorizeLive:false as const};
  return Object.freeze({...payload,
    assessmentHash:hash({payload,asOf:input.asOf,start:input.lineageStartAt,
      runtime:r,feedProofs:input.feeds.map(f=>[f.asset,f.observationEvidenceId,f.entitlementEvidenceId]),
      grades:input.grades.map(g=>g.gradeHash),tail:input.journal?.tailHash??null})});
}

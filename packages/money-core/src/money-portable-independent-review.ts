import {createHash} from 'node:crypto';
import {assessNewMoneyForwardOnly,type MoneyPortableProof,
  type MoneyForwardOnlyFeed} from './money-forward-only-commissioning.js';
import {type MoneyForwardGrade} from './money-finish-forward-grades.js';
import {type MoneyForwardJournalReadback,type MoneyPaperCycleEvidence}
  from './money-finish-forward-journal.js';
import {type MoneyPortableQuoteEnvelope} from './money-portable-readonly-quote-ingress.js';

export const MONEY_PORTABLE_REVIEW_SCHEMA='MONEY-PORTABLE.06' as const;
export type MoneyPortableHostBootEvidence=Readonly<{
  beforeBootId:string;afterBootId:string;canarySha256Before:string;
  canarySha256After:string;mountReviewEvidenceId:string;
  independentBackupRestoreEvidenceId:string;
}>;
export type MoneyPortableIndependentReview=Readonly<{
 schemaVersion:typeof MONEY_PORTABLE_REVIEW_SCHEMA;
 scope:'NEW_FORWARD_ONLY_PAPER_NOT_ORIGINAL_SHADOW';
 state:'BLOCKED'|'INDEPENDENT_OPERATIONAL_REVIEW_REQUIRED';
 reasonCodes:readonly string[];
 hostReadbackChecked:boolean;allAssetsObserved:boolean;
 graderHorizonCoverage:readonly string[];
 realPaperCycles:number;sourceObservationCount:number;
 sourceHash:string;
 historicalShadowRecovered:false;paperWorkerOperationallyCertified:false;
 finalCertification:'NOT_ISSUED';authority:'EVIDENCE_ONLY';
 canExecute:false;canAuthorizeLive:false;
}>;
const digest=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const check=(s:unknown)=>typeof s==='string'&&s.trim().length>0;
export function reviewMoneyPortableIndependentEvidence(input:Readonly<{
  asOf:string;lineageStartAt:string;host:MoneyPortableHostBootEvidence;
  runtime:MoneyPortableProof;feeds:readonly MoneyForwardOnlyFeed[];
  quotes:readonly MoneyPortableQuoteEnvelope[];grades:readonly MoneyForwardGrade[];
  journal:MoneyForwardJournalReadback|null;cycles:readonly MoneyPaperCycleEvidence[];
  priorShadowRowsImported:boolean;liveOrdersDisabled:boolean;
}>):MoneyPortableIndependentReview{
  const reasons:string[]=[];
  const basic=assessNewMoneyForwardOnly({
    asOf:input.asOf,lineageStartAt:input.lineageStartAt,runtime:input.runtime,
    feeds:input.feeds,grades:input.grades,journal:input.journal,
    cycles:input.cycles,priorShadowRowsImported:input.priorShadowRowsImported,
    liveOrdersDisabled:input.liveOrdersDisabled
  });
  reasons.push(...basic.reasonCodes);
  const {host:h}=input;
  if(!check(h.beforeBootId)||!check(h.afterBootId)||h.beforeBootId===h.afterBootId||
     !/^[a-f0-9]{64}$/i.test(h.canarySha256Before)||
     h.canarySha256Before!==h.canarySha256After||
     !check(h.mountReviewEvidenceId)||!check(h.independentBackupRestoreEvidenceId))
    reasons.push('INDEPENDENT_HOST_RESTART_AND_BACKUP_NOT_PROVEN');
  if(basic.state!=='PAPER_EVIDENCE_REVIEW_REQUIRED')
    reasons.push('REAL_SIX_HORIZON_THREE_CYCLE_EVIDENCE_INCOMPLETE');
  const supported=new Set(input.feeds.filter(x=>x.origin==='LICENSED_READ_ONLY').map(x=>x.asset));
  if([...supported].length!==4)reasons.push('ALL_ASSET_CLASSES_NOT_LICENSED');
  if(input.quotes.length<6)reasons.push('INSUFFICIENT_INDEPENDENT_QUOTE_SAMPLES');
  const unique=new Set<string>();
  for(const envelope of input.quotes){
    if(!envelope||envelope.researchOnly!==true||
       envelope.canAuthorizeLive!==false||envelope.canExecute!==false||
       envelope.rights.observationMode!=='LIVE_READ_ONLY'||
       !check(envelope.rights.independentReviewEvidenceId)||
       envelope.rights.canExecute!==false||
       envelope.quote.status!=='VERIFIED_READ_ONLY'||
       envelope.quote.evidenceId!==envelope.originalSourceEvidenceId)
      reasons.push('UNVERIFIED_OR_EXECUTING_QUOTE');
    const {envelopeHash,...body}=envelope;
    if(envelopeHash!==digest(body))reasons.push('QUOTE_ENVELOPE_TAMPERED');
    const key=envelope.quote.sourceId+'|'+envelope.quote.quoteId;
    if(unique.has(key))reasons.push('DUPLICATE_MARKET_SOURCE_QUOTE');
    unique.add(key);
    if(Date.parse(envelope.quote.receivedAt)>Date.parse(input.asOf)||
       Date.parse(envelope.quote.observedAt)<Date.parse(input.lineageStartAt))
      reasons.push('SOURCE_QUOTE_OUTSIDE_FORWARD_WINDOW');
  }
  const reasonCodes=Object.freeze([...new Set(reasons)].sort());
  const payload={schemaVersion:MONEY_PORTABLE_REVIEW_SCHEMA,
    scope:'NEW_FORWARD_ONLY_PAPER_NOT_ORIGINAL_SHADOW' as const,
    state:(reasonCodes.length?'BLOCKED':'INDEPENDENT_OPERATIONAL_REVIEW_REQUIRED') as
      MoneyPortableIndependentReview['state'],
    reasonCodes,hostReadbackChecked:!reasons.includes('INDEPENDENT_HOST_RESTART_AND_BACKUP_NOT_PROVEN'),
    allAssetsObserved:supported.size===4,
    graderHorizonCoverage:basic.horizonCoverage,
    realPaperCycles:input.cycles.length,sourceObservationCount:input.quotes.length,
    historicalShadowRecovered:false as const,paperWorkerOperationallyCertified:false as const,
    finalCertification:'NOT_ISSUED' as const,authority:'EVIDENCE_ONLY' as const,
    canExecute:false as const,canAuthorizeLive:false as const};
  return Object.freeze({...payload,sourceHash:digest({
    inputHead:input.runtime.expectedMainSha,basic:basic.assessmentHash,
    host:h,quotes:input.quotes.map(x=>x.envelopeHash),
    journal:input.journal?.tailHash??null,cycles:input.cycles.map(x=>x.journalTailHash)
  })});
}

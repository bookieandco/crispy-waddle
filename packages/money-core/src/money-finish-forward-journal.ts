import {createHash} from 'node:crypto';
import {dirname} from 'node:path';
import {readFile,mkdir,open,unlink} from 'node:fs/promises';
import {assertMoneyForwardGrade,type MoneyForwardGrade} from './money-finish-forward-grades.js';

export const MONEY_FORWARD_JOURNAL_SCHEMA='MONEY-FINISH-14-JOURNAL' as const;
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
type ForwardJournalRow=Readonly<{
  schemaVersion:typeof MONEY_FORWARD_JOURNAL_SCHEMA;
  sequence:number;previousHash:string;grade:MoneyForwardGrade;
  eventHash:string;
}>;
export type MoneyForwardJournalReadback=Readonly<{
  count:number;tailHash:string;gradeIds:readonly string[];eventHashes:readonly string[];
  integrity:'HASH_CHAIN_VERIFIED';canExecute:false;canAuthorizeLive:false;
}>;
function parse(raw:string):readonly ForwardJournalRow[]{
  if(!raw)return [];
  if(!raw.endsWith('\n'))throw new Error('MONEY_FORWARD_JOURNAL_PARTIAL_WRITE');
  const result:ForwardJournalRow[]=[];let prior='GENESIS';
  const keys=new Set<string>();const ids=new Set<string>();
  for(const line of raw.slice(0,-1).split('\n')){
    let candidate:ForwardJournalRow;
    try{candidate=JSON.parse(line) as ForwardJournalRow;}
    catch{throw new Error('MONEY_FORWARD_JOURNAL_UNREADABLE_JSON');}
    if(!candidate||candidate.schemaVersion!==MONEY_FORWARD_JOURNAL_SCHEMA||
      candidate.sequence!==result.length+1||candidate.previousHash!==prior||
      !candidate.grade)throw new Error('MONEY_FORWARD_JOURNAL_CHAIN_INVALID');
    assertMoneyForwardGrade(candidate.grade);
    const {eventHash,...base}=candidate;
    if(hash(base)!==eventHash)throw new Error('MONEY_FORWARD_JOURNAL_HASH_INVALID');
    const key=candidate.grade.predictionId+'|'+candidate.grade.horizon;
    if(keys.has(key)||ids.has(candidate.grade.gradeId))
      throw new Error('MONEY_FORWARD_JOURNAL_DUPLICATE_GRADE');
    keys.add(key);ids.add(candidate.grade.gradeId);
    prior=eventHash;result.push(Object.freeze(candidate));
  }
  return Object.freeze(result);
}
export class MoneyLocalForwardJournal {
  constructor(readonly filePath:string){
    if(!filePath.trim()||filePath.endsWith('/')||filePath.includes('\0'))
      throw new Error('MONEY_FORWARD_JOURNAL_PATH_INVALID');
  }
  private async raw():Promise<string>{
    try{return await readFile(this.filePath,'utf8');}
    catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return '';throw e;}
  }
  private async rows():Promise<readonly ForwardJournalRow[]>{
    return parse(await this.raw());
  }
  async append(grade:MoneyForwardGrade):Promise<Readonly<{disposition:'INSERTED'|'REPLAY';eventHash:string;sequence:number}>>{
    assertMoneyForwardGrade(grade);
    await mkdir(dirname(this.filePath),{recursive:true});
    const lock=this.filePath+'.lock';
    // A stale/crashed lock deliberately blocks further writes until an operator audits it.
    const handle=await open(lock,'wx');
    try{
      const rows=await this.rows();
      const prior=rows.find(r=>r.grade.predictionId===grade.predictionId&&r.grade.horizon===grade.horizon);
      if(prior){
        if(prior.grade.gradeHash!==grade.gradeHash)
          throw new Error('MONEY_FORWARD_JOURNAL_IDEMPOTENCY_CONFLICT');
        return Object.freeze({disposition:'REPLAY',eventHash:prior.eventHash,sequence:prior.sequence});
      }
      const base={schemaVersion:MONEY_FORWARD_JOURNAL_SCHEMA,sequence:rows.length+1,
        previousHash:rows.at(-1)?.eventHash??'GENESIS',grade};
      const eventHash=hash(base);
      const file=await open(this.filePath,'a');
      try{await file.writeFile(JSON.stringify({...base,eventHash})+'\n');await file.sync();}
      finally{await file.close();}
      const fresh=await this.rows();
      if(fresh.length!==rows.length+1||fresh.at(-1)?.eventHash!==eventHash)
        throw new Error('MONEY_FORWARD_JOURNAL_READBACK_MISMATCH');
      return Object.freeze({disposition:'INSERTED',eventHash,sequence:rows.length+1});
    }finally{
      await handle.close();
      await unlink(lock);
    }
  }
  async list():Promise<readonly MoneyForwardGrade[]>{
    return Object.freeze((await this.rows()).map(r=>r.grade));
  }
  async verifyReadback():Promise<MoneyForwardJournalReadback>{
    const rows=await this.rows();
    if(!rows.length)throw new Error('MONEY_FORWARD_JOURNAL_EMPTY_NOT_COMMISSIONED');
    return Object.freeze({count:rows.length,tailHash:rows.at(-1)!.eventHash,
      gradeIds:Object.freeze(rows.map(r=>r.grade.gradeId)),eventHashes:Object.freeze(rows.map(r=>r.eventHash)),integrity:'HASH_CHAIN_VERIFIED',
      canExecute:false,canAuthorizeLive:false});
  }
}
export type MoneyPaperCycleEvidence=Readonly<{
  cycleId:string;completedAt:string;
  journalTailHash:string;
  journalCount:number;
  evidenceIds:readonly string[];
  realFeedOrigin:'LICENSED_READ_ONLY'|'SYNTHETIC_FIXTURE';
  isolatedIndependentReadback:boolean;
}>;
export type MoneyPaperWatchdogAssessment=Readonly<{
  state:'AUDIT_REPAIR_REQUIRED'|'EVIDENCE_REVIEW_ONLY';
  reasonCodes:readonly string[];cyclesChecked:number;
  horizonCoverage:readonly string[];
  authority:'PAPER_WATCHDOG_ONLY';canExecute:false;canAuthorizeLive:false;
}>;
export function assessMoneyPaperWatchdog(input:Readonly<{
  cycles:readonly MoneyPaperCycleEvidence[];
  readback:MoneyForwardJournalReadback|null;
  grades:readonly MoneyForwardGrade[];
  asOf:string;minimumCycles:number;maxCycleGapMs:number;
  providerEntitlementVerified:boolean;originalShadowStoreRecovered:boolean;
}>):MoneyPaperWatchdogAssessment{
  const reasons:string[]=[];
  if(!Number.isSafeInteger(input.minimumCycles)||input.minimumCycles<3||
     !Number.isSafeInteger(input.maxCycleGapMs)||input.maxCycleGapMs<=0)
    throw new Error('MONEY_FORWARD_WATCHDOG_POLICY_INVALID');
  const now=Date.parse(input.asOf);
  if(!Number.isFinite(now))throw new Error('MONEY_FORWARD_WATCHDOG_TIME_INVALID');
  if(!input.providerEntitlementVerified)reasons.push('LICENSED_PROVIDER_NOT_COMMISSIONED');
  if(!input.originalShadowStoreRecovered)reasons.push('ORIGINAL_SHADOW_RESTORE_UNVERIFIED');
  if(!input.readback||input.readback.integrity!=='HASH_CHAIN_VERIFIED'||
     input.readback.count!==input.grades.length||
     input.readback.gradeIds.some((id,i)=>id!==input.grades[i]?.gradeId))
    reasons.push('DURABLE_JOURNAL_READBACK_UNVERIFIED');
  if(input.cycles.length<input.minimumCycles)reasons.push('INSUFFICIENT_DISTINCT_WATCHDOG_CYCLES');
  const seen=new Set<string>();let prior=-Infinity;
  for(const cycle of input.cycles){
    const t=Date.parse(cycle.completedAt);
    if(!cycle.cycleId.trim()||seen.has(cycle.cycleId)||!Number.isFinite(t)||t<=prior||t>now||
       !cycle.journalTailHash.trim()||!cycle.evidenceIds.length)
      throw new Error('MONEY_FORWARD_WATCHDOG_CYCLE_INVALID');
    if(prior!==-Infinity&&t-prior>input.maxCycleGapMs)reasons.push('WATCHDOG_HEARTBEAT_GAP');
    if(!Number.isSafeInteger(cycle.journalCount)||cycle.journalCount<1||
       !input.readback||cycle.journalCount>input.readback.count||
       input.readback.eventHashes[cycle.journalCount-1]!==cycle.journalTailHash||
       (input.cycles.indexOf(cycle)>0&&cycle.journalCount<=input.cycles[input.cycles.indexOf(cycle)-1]!.journalCount))
      reasons.push('CYCLE_DID_NOT_ADVANCE_VERIFIED_JOURNAL');
    if(cycle.realFeedOrigin!=='LICENSED_READ_ONLY'||!cycle.isolatedIndependentReadback)
      reasons.push('CYCLE_USES_SYNTHETIC_OR_UNVERIFIED_EVIDENCE');
    seen.add(cycle.cycleId);prior=t;
  }
  if(input.cycles.length&&(input.readback?.tailHash!==input.cycles.at(-1)?.journalTailHash||
     input.readback?.count!==input.cycles.at(-1)?.journalCount))
    reasons.push('CYCLE_JOURNAL_TAIL_NOT_RECONCILED');
  for(const grade of input.grades)assertMoneyForwardGrade(grade);
  const coverage=Object.freeze([...new Set(input.grades.map(g=>g.horizon))].sort());
  for(const horizon of ['15m','1h','4h','24h','3d','7d'])
    if(!coverage.includes(horizon))reasons.push('MISSING_HORIZON_'+horizon.toUpperCase());
  const reasonCodes=Object.freeze([...new Set(reasons)].sort());
  // Even full software evidence is an engineering review state; an
  // independent operations commissioning authority must certify the live source.
  return Object.freeze({state:reasonCodes.length?'AUDIT_REPAIR_REQUIRED':'EVIDENCE_REVIEW_ONLY',
    reasonCodes,cyclesChecked:input.cycles.length,horizonCoverage:coverage,
    authority:'PAPER_WATCHDOG_ONLY',canExecute:false,canAuthorizeLive:false});
}

import {createHash} from 'node:crypto';
import {dirname} from 'node:path';
import {mkdir,open,readFile,unlink} from 'node:fs/promises';
import {MoneyLocalForwardJournal} from './money-finish-forward-journal.js';
import {gradeMoneyForwardHorizon,validateForwardQuote,MONEY_FORWARD_HORIZONS,
  type MoneyForwardPrediction,type MoneyForwardQuote,type MoneyForwardHorizon
} from './money-finish-forward-grades.js';

/** Append-only, separately sourced research predictions; cannot route orders. */
export const MONEY_FORWARD_RESEARCH_CYCLE_SCHEMA='MONEY-PORTABLE-PAPER.2' as const;
const hash=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const PERIOD_MS:Record<MoneyForwardHorizon,number>={
  '15m':900000,'1h':3600000,'4h':14400000,'24h':86400000,'3d':259200000,'7d':604800000
};
const ms=(value:string):number=>{
  const n=Date.parse(value);
  if(!value||!Number.isFinite(n))throw new Error('MONEY_PORTABLE_PAPER_TIME_INVALID');
  return n;
};
const present=(x:unknown)=>typeof x==='string'&&x.trim().length>0;
export type ForwardPredictionRecord=Readonly<{
  schemaVersion:typeof MONEY_FORWARD_RESEARCH_CYCLE_SCHEMA;
  sequence:number;previousHash:string;
  prediction:MoneyForwardPrediction;
  eventHash:string;
}>;
export type ForwardProviderReceipt=Readonly<{
  sourceId:string;entitlementEvidenceId:string;sourceObservationReceiptId:string;
  origin:'LICENSED_READ_ONLY'|'SYNTHETIC_FIXTURE'|'UNVERIFIED';
  checkedByIndependentOperator:boolean;
  canExecute:false;
}>;
export type ForwardResearchCycle=Readonly<{
  schemaVersion:typeof MONEY_FORWARD_RESEARCH_CYCLE_SCHEMA;
  assessedAt:string;predictionCount:number;previouslyGraded:number;
  insertedGrades:number;replayedGrades:number;
  overdueMarks:readonly string[];unmaturedHorizons:readonly string[];
  journalTailHash:string|null;journalCount:number;
  proof:'FORWARD_PAPER_RESEARCH_ONLY';canExecute:false;canAuthorizeLive:false;
}>;
function assertResearchPrediction(p:MoneyForwardPrediction):void{
  if(!p||p.authority!=='RESEARCH_ONLY'||p.canExecute!==false||p.canAuthorizeLive!==false||
     !present(p.predictionId)||!present(p.candidateId)||!present(p.candidateHash)||
     !present(p.instrumentId)||!present(p.sourceRightsEvidenceId)||
     !Array.isArray(p.informationEvidenceIds)||!p.informationEvidenceIds.length||
     !['LONG_BIAS','SHORT_BIAS','NO_TRADE'].includes(p.direction)||
     !p.entry||p.entry.instrumentId!==p.instrumentId)throw new Error('MONEY_PORTABLE_PREDICTION_UNTRUSTED');
  const cutoff=ms(p.informationCutoff),decision=ms(p.decisionAt),created=ms(p.createdAt);
  if(cutoff>decision||decision>created)throw new Error('MONEY_PORTABLE_PREDICTION_CHRONOLOGY');
  validateForwardQuote(p.entry,p.informationCutoff,10000);
}
function parseLedger(raw:string):readonly ForwardPredictionRecord[]{
  if(!raw)return [];
  if(!raw.endsWith('\n'))throw new Error('MONEY_PORTABLE_PREDICTION_PARTIAL_WRITE');
  const rows:ForwardPredictionRecord[]=[];const seen=new Set<string>();
  for(const line of raw.slice(0,-1).split('\n')){
    let record:ForwardPredictionRecord;
    try{record=JSON.parse(line) as ForwardPredictionRecord;}
    catch{throw new Error('MONEY_PORTABLE_PREDICTION_JSON_INVALID');}
    if(!record||record.schemaVersion!==MONEY_FORWARD_RESEARCH_CYCLE_SCHEMA||
       record.sequence!==rows.length+1||record.previousHash!==(rows.at(-1)?.eventHash??'GENESIS')||
       !record.prediction)throw new Error('MONEY_PORTABLE_PREDICTION_CHAIN_BROKEN');
    assertResearchPrediction(record.prediction);
    const {eventHash,...base}=record;
    if(eventHash!==hash(base)||seen.has(record.prediction.predictionId))
      throw new Error('MONEY_PORTABLE_PREDICTION_HASH_OR_ID_INVALID');
    seen.add(record.prediction.predictionId);rows.push(record);
  }
  return Object.freeze(rows);
}
export class MoneyForwardResearchQueue{
  constructor(readonly path:string){
    if(!path.trim()||path.includes('\0')||path.endsWith('/'))
      throw new Error('MONEY_PORTABLE_PREDICTION_PATH_INVALID');
  }
  async list():Promise<readonly MoneyForwardPrediction[]>{
    let raw='';
    try{raw=await readFile(this.path,'utf8');}
    catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
    return Object.freeze(parseLedger(raw).map(x=>x.prediction));
  }
  async register(p:MoneyForwardPrediction):Promise<Readonly<{
    disposition:'INSERTED'|'REPLAY';sequence:number;eventHash:string;
  }>>{
    assertResearchPrediction(p);
    await mkdir(dirname(this.path),{recursive:true});
    // Never auto-clear a stale lock after a crash; stop for manual disk audit.
    const lock=await open(this.path+'.lock','wx');
    try{
      let raw='';
      try{raw=await readFile(this.path,'utf8');}
      catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
      const rows=parseLedger(raw);
      const prior=rows.find(r=>r.prediction.predictionId===p.predictionId);
      if(prior){
        if(hash(prior.prediction)!==hash(p))
          throw new Error('MONEY_PORTABLE_PREDICTION_REPLAY_CONFLICT');
        return Object.freeze({disposition:'REPLAY' as const,sequence:prior.sequence,eventHash:prior.eventHash});
      }
      const base={schemaVersion:MONEY_FORWARD_RESEARCH_CYCLE_SCHEMA,
        sequence:rows.length+1,previousHash:rows.at(-1)?.eventHash??'GENESIS',prediction:p};
      const eventHash=hash(base);
      const handle=await open(this.path,'a');
      try{await handle.writeFile(JSON.stringify({...base,eventHash})+'\n');await handle.sync();}
      finally{await handle.close();}
      const reread=parseLedger(await readFile(this.path,'utf8'));
      if(reread.length!==rows.length+1||reread.at(-1)?.eventHash!==eventHash)
        throw new Error('MONEY_PORTABLE_PREDICTION_READBACK_MISMATCH');
      return Object.freeze({disposition:'INSERTED' as const,sequence:rows.length+1,eventHash});
    }finally{await lock.close();await unlink(this.path+'.lock');}
  }
}
export async function gradeMoneyForwardResearchCycle(input:Readonly<{
  queue:MoneyForwardResearchQueue;journal:MoneyLocalForwardJournal;
  quoteEvidence:readonly MoneyForwardQuote[];
  providers:readonly ForwardProviderReceipt[];
  asOf:string;maximumMarkDelayMs:number;
  maximumExitSpreadBps:number;additionalRoundTripCostBps:number;
}>):Promise<ForwardResearchCycle>{
  const now=ms(input.asOf);
  if(!Number.isSafeInteger(input.maximumMarkDelayMs)||input.maximumMarkDelayMs<0||
     !Number.isFinite(input.additionalRoundTripCostBps)||input.additionalRoundTripCostBps<0||
     !Number.isFinite(input.maximumExitSpreadBps)||input.maximumExitSpreadBps<=0)
    throw new Error('MONEY_PORTABLE_PAPER_POLICY_INVALID');
  const bySource=new Map<string,ForwardProviderReceipt>();
  for(const p of input.providers){
    if(!present(p.sourceId)||bySource.has(p.sourceId)||!present(p.entitlementEvidenceId)||
       !present(p.sourceObservationReceiptId)||p.origin!=='LICENSED_READ_ONLY'||
       !p.checkedByIndependentOperator||p.canExecute!==false)
      throw new Error('MONEY_PORTABLE_PROVIDER_ENTITLEMENT_UNVERIFIED');
    bySource.set(p.sourceId,p);
  }
  // Quotes are input *only*: no network operations or inference of authenticity from a string.
  for(const q of input.quoteEvidence){
    if(!bySource.has(q.sourceId))throw new Error('MONEY_PORTABLE_QUOTE_UNENTITLED');
    validateForwardQuote(q,input.asOf,input.maximumExitSpreadBps);
  }
  const predictions=await input.queue.list();
  const past=await input.journal.list();
  const completed=new Set(past.map(x=>x.predictionId+'|'+x.horizon));
  const unresolved:string[]=[];const premature:string[]=[];
  let inserted=0,replayed=0;
  for(const p of predictions){
    assertResearchPrediction(p);
    if(!bySource.has(p.entry.sourceId))throw new Error('MONEY_PORTABLE_ENTRY_SOURCE_UNVERIFIED');
    if(now<ms(p.createdAt))throw new Error('MONEY_PORTABLE_PREDICTION_FROM_FUTURE');
    for(const horizon of MONEY_FORWARD_HORIZONS){
      const identity=p.predictionId+'|'+horizon;
      if(completed.has(identity))continue;
      const due=ms(p.decisionAt)+PERIOD_MS[horizon];
      if(now<due){premature.push(identity);continue;}
      const candidates=input.quoteEvidence.filter(q=>
        q.instrumentId===p.instrumentId&&q.sourceId===p.entry.sourceId&&
        q.quoteId!==p.entry.quoteId&&ms(q.observedAt)>=due&&
        ms(q.observedAt)<=due+input.maximumMarkDelayMs&&
        ms(q.receivedAt)<=now
      ).sort((a,b)=>ms(a.observedAt)-ms(b.observedAt)||a.quoteId.localeCompare(b.quoteId));
      const exit=candidates[0];
      if(!exit){
        unresolved.push(identity+(now>due+input.maximumMarkDelayMs?':OVERDUE':':WAITING_FOR_MARK'));
        continue;
      }
      const grade=gradeMoneyForwardHorizon({prediction:p,horizon,exit,
        gradedAt:input.asOf,maximumMarkDelayMs:input.maximumMarkDelayMs,
        maximumExitSpreadBps:input.maximumExitSpreadBps,
        additionalRoundTripCostBps:input.additionalRoundTripCostBps});
      const result=await input.journal.append(grade);
      if(result.disposition==='INSERTED')inserted++;
      else replayed++;
      completed.add(identity);
    }
  }
  let tail:string|null=null,count=0;
  if(past.length+inserted>0){
    const fresh=await input.journal.verifyReadback();
    tail=fresh.tailHash;count=fresh.count;
  }
  return Object.freeze({schemaVersion:MONEY_FORWARD_RESEARCH_CYCLE_SCHEMA,
    assessedAt:input.asOf,predictionCount:predictions.length,
    previouslyGraded:past.length,insertedGrades:inserted,replayedGrades:replayed,
    overdueMarks:Object.freeze(unresolved.sort()),unmaturedHorizons:Object.freeze(premature.sort()),
    journalTailHash:tail,journalCount:count,
    proof:'FORWARD_PAPER_RESEARCH_ONLY' as const,
    canExecute:false as const,canAuthorizeLive:false as const});
}

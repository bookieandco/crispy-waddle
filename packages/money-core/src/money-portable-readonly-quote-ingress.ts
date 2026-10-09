import {createHash} from 'node:crypto';
import {dirname} from 'node:path';
import {mkdir,open,readFile,unlink} from 'node:fs/promises';
import {validateForwardQuote,type MoneyForwardQuote} from './money-finish-forward-grades.js';
import {gradeMoneyForwardResearchCycle,MoneyForwardResearchQueue,
  type ForwardProviderReceipt,type ForwardResearchCycle} from './money-forward-durable-research-cycles.js';
import {MoneyLocalForwardJournal} from './money-finish-forward-journal.js';
import type {StockQuote} from './stock-market-reality.js';
import type {AlpacaStockMarketDataClient,AlpacaStockFeed} from './alpaca-stock-market-data.js';
import type {FxQuote} from './fx-market-reality.js';
import type {MetalQuote} from './metals-market-reality.js';
import type {OptionChainRow} from './money-finish-option-chain.js';

export const MONEY_PORTABLE_INGRESS_SCHEMA='MONEY-PORTABLE.04-05' as const;
const sha=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const at=(x:string)=>{const n=Date.parse(x);if(!x||!Number.isFinite(n))throw new Error('MONEY_PORTABLE_INGRESS_DATE_INVALID');return n;};
const nonempty=(s:unknown)=>typeof s==='string'&&s.trim().length>0;
export type MoneyPortableAsset='STOCK'|'FOREX'|'METALS'|'OPTIONS';
export type MoneyPortableRightsReceipt=Readonly<{
 asset:MoneyPortableAsset;sourceId:string;vendorId:string;
 entitlementEvidenceId:string;sourceObservationReceiptId:string;
 independentReviewEvidenceId:string;sourceResponseSha256:string;
 observationMode:'LIVE_READ_ONLY'|'SYNTHETIC'|'UNKNOWN';
 authorizedResearchUse:true;authorizedRetention:true;allowsForwardPaperStudy:true;
 expiresAt:string;canExecute:false;canAuthorizeLive:false;
}>;
export type MoneyPortableQuoteEnvelope=Readonly<{
 schemaVersion:typeof MONEY_PORTABLE_INGRESS_SCHEMA;
 asset:MoneyPortableAsset;quote:MoneyForwardQuote;
 rights:MoneyPortableRightsReceipt;
 originalSourceEvidenceId:string;
 researchOnly:true;canExecute:false;canAuthorizeLive:false;
 envelopeHash:string;
}>;
type SourceQuote=Readonly<{quoteId:string;instrumentId:string;provider:string;
  bid:string;ask:string;observedAt:string;availableAt:string;receivedAt:string;
  evidenceId:string;provenanceHash:string}>;
function parsePrice(x:string):number{
 if(!/^(0|[1-9][0-9]*)(\.[0-9]+)?$/.test(x))throw new Error('MONEY_PORTABLE_PRICE_FORMAT_INVALID');
 const n=Number(x);if(!Number.isFinite(n)||n<=0)throw new Error('MONEY_PORTABLE_PRICE_INVALID');
 return n;
}
export function admitPortableReadOnlyQuote(input:Readonly<{
 asset:MoneyPortableAsset;source:SourceQuote;rights:MoneyPortableRightsReceipt;
 asOf:string;maxQuoteAgeMs:number;maxSpreadBps:number;
 adjustedOptionContractVerified?:boolean;optionSettlementVerified?:boolean;
 forexSessionVerified?:boolean;metalsUnitsVerified?:boolean;
}>):MoneyPortableQuoteEnvelope{
 const {source:q,rights:r}=input,now=at(input.asOf);
 if(!Number.isSafeInteger(input.maxQuoteAgeMs)||input.maxQuoteAgeMs<=0||
    !Number.isFinite(input.maxSpreadBps)||input.maxSpreadBps<=0)
    throw new Error('MONEY_PORTABLE_ADMISSION_POLICY_REQUIRED');
 if(!nonempty(q.instrumentId)||!nonempty(q.quoteId)||!nonempty(q.provider)||
    !nonempty(q.evidenceId)||!nonempty(q.provenanceHash)||
    !nonempty(r.vendorId)||!nonempty(r.entitlementEvidenceId)||
    !nonempty(r.sourceObservationReceiptId)||!nonempty(r.independentReviewEvidenceId)||
    !/^[a-f0-9]{64}$/i.test(r.sourceResponseSha256)||
    r.asset!==input.asset||r.sourceId!==q.provider||
    r.observationMode!=='LIVE_READ_ONLY'||r.authorizedResearchUse!==true||
    r.authorizedRetention!==true||r.allowsForwardPaperStudy!==true||
    r.canExecute!==false||r.canAuthorizeLive!==false)
    throw new Error('MONEY_PORTABLE_LICENSED_SOURCE_NOT_VERIFIED');
 if(at(r.expiresAt)<now)throw new Error('MONEY_PORTABLE_LICENSE_EXPIRED');
 if(input.asset==='OPTIONS'&&
    (!input.adjustedOptionContractVerified||!input.optionSettlementVerified))
    throw new Error('MONEY_PORTABLE_OPTION_TERMS_NOT_VERIFIED');
 if(input.asset==='FOREX'&&!input.forexSessionVerified)
    throw new Error('MONEY_PORTABLE_FX_SESSION_UNVERIFIED');
 if(input.asset==='METALS'&&!input.metalsUnitsVerified)
    throw new Error('MONEY_PORTABLE_METALS_UNIT_UNVERIFIED');
 const quote:MoneyForwardQuote=Object.freeze({
   quoteId:q.quoteId,instrumentId:q.instrumentId,sourceId:q.provider,
   bid:parsePrice(q.bid),ask:parsePrice(q.ask),
   observedAt:q.observedAt,availableAt:q.availableAt,receivedAt:q.receivedAt,
   evidenceId:q.evidenceId,provenanceHash:q.provenanceHash,
   status:'VERIFIED_READ_ONLY'
 });
 validateForwardQuote(quote,input.asOf,input.maxSpreadBps);
 if(now-at(quote.observedAt)>input.maxQuoteAgeMs)
   throw new Error('MONEY_PORTABLE_FEED_STALE_OR_MARKET_CLOSED');
 const base={schemaVersion:MONEY_PORTABLE_INGRESS_SCHEMA,asset:input.asset,quote,
   rights:Object.freeze({...r}),originalSourceEvidenceId:q.evidenceId,
   researchOnly:true as const,canExecute:false as const,canAuthorizeLive:false as const};
 return Object.freeze({...base,envelopeHash:sha(base)});
}
export function fromAlpacaStockQuote(q:StockQuote):SourceQuote{
 return {quoteId:q.quoteId,instrumentId:q.instrumentId,provider:q.provider,
   bid:q.bidPrice,ask:q.askPrice,observedAt:q.observedAt,
   availableAt:q.availableAt,receivedAt:q.receivedAt,
   evidenceId:q.evidenceRef,provenanceHash:q.provenanceHash};
}
export function fromFxTwoSidedQuote(q:FxQuote):SourceQuote{
 if(q.sourceType!=='DIRECT')throw new Error('MONEY_PORTABLE_FX_SYNTHETIC_CROSS_DENIED');
 return {quoteId:q.quoteId,instrumentId:q.pairId,provider:q.provider,
   bid:q.bidPrice,ask:q.askPrice,observedAt:q.observedAt,
   availableAt:q.availableAt,receivedAt:q.receivedAt,
   evidenceId:q.evidenceRefs[0]??'',provenanceHash:q.provenanceHash};
}
export function fromMetalTwoSidedQuote(q:MetalQuote):SourceQuote{
 return {quoteId:q.quoteId,instrumentId:q.instrumentId,provider:q.provider,
   bid:q.bidPrice,ask:q.askPrice,observedAt:q.observedAt,
   availableAt:q.availableAt,receivedAt:q.receivedAt,
   evidenceId:q.evidenceRefs[0]??'',provenanceHash:q.provenanceHash};
}
export function fromOptionTwoSidedQuote(q:OptionChainRow):SourceQuote{
 if(!q.settlementEvidenceId||!q.adjustmentEvidenceRefs.length)
   throw new Error('MONEY_PORTABLE_OPTION_CONTRACT_PROOF_REQUIRED');
 return {quoteId:q.evidenceRef,instrumentId:'option:'+q.occSymbol,provider:q.provider,
   bid:q.bid,ask:q.ask,observedAt:q.observedAt,availableAt:q.availableAt,
   receivedAt:q.receivedAt,evidenceId:q.evidenceRef,provenanceHash:q.provenanceHash};
}
function assertEnvelope(e:MoneyPortableQuoteEnvelope):void{
 if(!e||e.schemaVersion!==MONEY_PORTABLE_INGRESS_SCHEMA||
    e.researchOnly!==true||e.canExecute!==false||e.canAuthorizeLive!==false||
    e.rights.canExecute!==false||e.rights.canAuthorizeLive!==false||
    e.rights.observationMode!=='LIVE_READ_ONLY'||
    e.originalSourceEvidenceId!==e.quote.evidenceId)
    throw new Error('MONEY_PORTABLE_INGRESS_AUTHORITY_DENIED');
 const {envelopeHash,...body}=e;
 if(envelopeHash!==sha(body))throw new Error('MONEY_PORTABLE_INGRESS_TAMPERED');
 validateForwardQuote(e.quote,e.quote.receivedAt,10000);
}
type Row=Readonly<{sequence:number;previousHash:string;envelope:MoneyPortableQuoteEnvelope;eventHash:string}>;
function parse(raw:string):readonly Row[]{
 if(!raw)return [];
 if(!raw.endsWith('\n'))throw new Error('MONEY_PORTABLE_INGRESS_TORN_LINE');
 let previous='GENESIS';const result:Row[]=[],seen=new Set<string>();
 for(const line of raw.slice(0,-1).split('\n')){
   let item:Row;
   try{item=JSON.parse(line) as Row;}catch{throw new Error('MONEY_PORTABLE_INGRESS_CORRUPT_JSON');}
   if(!item||item.sequence!==result.length+1||item.previousHash!==previous||!item.envelope)
     throw new Error('MONEY_PORTABLE_INGRESS_CHAIN_BROKEN');
   assertEnvelope(item.envelope);
   const {eventHash,...body}=item;
   if(eventHash!==sha(body))throw new Error('MONEY_PORTABLE_INGRESS_EVENT_TAMPERED');
   const key=item.envelope.quote.sourceId+'|'+item.envelope.quote.quoteId;
   if(seen.has(key))throw new Error('MONEY_PORTABLE_INGRESS_DUPLICATE_QUOTE');
   seen.add(key);previous=eventHash;result.push(item);
 }
 return result;
}
export class MoneyPortableQuoteJournal{
 constructor(readonly path:string){
   if(!path.trim()||path.endsWith('/')||path.includes('\0'))
     throw new Error('MONEY_PORTABLE_INGRESS_PATH_INVALID');
 }
 private async rows():Promise<readonly Row[]>{
   try{return parse(await readFile(this.path,'utf8'));}
   catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return [];throw e;}
 }
 async list():Promise<readonly MoneyPortableQuoteEnvelope[]>{
   return Object.freeze((await this.rows()).map(x=>x.envelope));
 }
 async append(envelope:MoneyPortableQuoteEnvelope):Promise<Readonly<{disposition:'INSERTED'|'REPLAY';sequence:number;eventHash:string}>>{
   assertEnvelope(envelope);
   await mkdir(dirname(this.path),{recursive:true});
   const lock=await open(this.path+'.lock','wx');
   try{
     const rows=await this.rows();
     const prior=rows.find(x=>x.envelope.quote.sourceId===envelope.quote.sourceId&&
       x.envelope.quote.quoteId===envelope.quote.quoteId);
     if(prior){
       if(prior.envelope.envelopeHash!==envelope.envelopeHash)
         throw new Error('MONEY_PORTABLE_INGRESS_IDEMPOTENCY_CONFLICT');
       return Object.freeze({disposition:'REPLAY' as const,sequence:prior.sequence,eventHash:prior.eventHash});
     }
     const base={sequence:rows.length+1,previousHash:rows.at(-1)?.eventHash??'GENESIS',envelope};
     const eventHash=sha(base),handle=await open(this.path,'a');
     try{await handle.writeFile(JSON.stringify({...base,eventHash})+'\n');await handle.sync();}
     finally{await handle.close();}
     const checked=await this.rows();
     if(checked.length!==rows.length+1||checked.at(-1)?.eventHash!==eventHash)
       throw new Error('MONEY_PORTABLE_INGRESS_READBACK_MISMATCH');
     return Object.freeze({disposition:'INSERTED' as const,sequence:checked.length,eventHash});
   }finally{await lock.close();await unlink(this.path+'.lock');}
 }
}
export async function runMoneyReadOnlyQuoteCycle(input:Readonly<{
 quoteJournal:MoneyPortableQuoteJournal;predictionQueue:MoneyForwardResearchQueue;
 gradeJournal:MoneyLocalForwardJournal;asOf:string;maxMarkDelayMs:number;
 maxSpreadBps:number;additionalRoundTripCostBps:number;
}>):Promise<Readonly<{cycle:ForwardResearchCycle;quoteCount:number;rightsReviewOnly:true;canExecute:false}>>{
 const recorded=await input.quoteJournal.list(),now=at(input.asOf);
 const latest=new Map<string,MoneyPortableRightsReceipt>();
 const quotes:MoneyForwardQuote[]=[];
 for(const e of recorded){
   assertEnvelope(e);
   if(at(e.quote.receivedAt)>now)throw new Error('MONEY_PORTABLE_INGRESS_FUTURE_QUOTE');
   if(at(e.rights.expiresAt)<now)throw new Error('MONEY_PORTABLE_SOURCE_RIGHTS_EXPIRED');
   latest.set(e.quote.sourceId,e.rights);quotes.push(e.quote);
 }
 const providers:ForwardProviderReceipt[]=[...latest.values()].map(p=>({
   sourceId:p.sourceId,entitlementEvidenceId:p.entitlementEvidenceId,
   sourceObservationReceiptId:p.sourceObservationReceiptId,
   origin:'LICENSED_READ_ONLY' as const,
   checkedByIndependentOperator:nonempty(p.independentReviewEvidenceId),
   canExecute:false as const
 }));
 const cycle=await gradeMoneyForwardResearchCycle({
   queue:input.predictionQueue,journal:input.gradeJournal,
   quoteEvidence:quotes,providers,asOf:input.asOf,
   maximumMarkDelayMs:input.maxMarkDelayMs,
   maximumExitSpreadBps:input.maxSpreadBps,
   additionalRoundTripCostBps:input.additionalRoundTripCostBps
 });
 return Object.freeze({cycle,quoteCount:quotes.length,rightsReviewOnly:true,canExecute:false});
}

/**
 * Authorized read-only Alpaca canary: existing adapter performs GETs only.
 * Credentials and actual vendor entitlement are injected at the host, never
 * persisted into the quote journal or printed by this function.
 */
export async function fetchAndRecordAlpacaStockQuote(input:Readonly<{
 client:Pick<AlpacaStockMarketDataClient,'getStockBundle'>;
 journal:MoneyPortableQuoteJournal;
 symbol:string;start:string;end:string;now:string;
 feed:AlpacaStockFeed;rights:MoneyPortableRightsReceipt;
 maxQuoteAgeMs:number;maxSpreadBps:number;
}>):Promise<Readonly<{
 quoteId:string;disposition:'INSERTED'|'REPLAY';
 sourceEvidenceId:string;canExecute:false;
}>>{
 if(input.rights.asset!=='STOCK'||
    input.rights.sourceId!=='alpaca-market-data:'+input.feed||
    input.rights.vendorId!=='alpaca')
   throw new Error('MONEY_PORTABLE_ALPACA_RIGHTS_SCOPE_INVALID');
 const bundle=await input.client.getStockBundle({
   symbol:input.symbol,start:input.start,end:input.end,
   now:input.now,feed:input.feed,maxBars:2
 });
 if(bundle.feed!==input.feed||!bundle.quote)
   throw new Error('MONEY_PORTABLE_ALPACA_QUOTE_UNAVAILABLE');
 const envelope=admitPortableReadOnlyQuote({
   asset:'STOCK',source:fromAlpacaStockQuote(bundle.quote),
   rights:input.rights,asOf:input.now,
   maxQuoteAgeMs:input.maxQuoteAgeMs,maxSpreadBps:input.maxSpreadBps
 });
 const result=await input.journal.append(envelope);
 return Object.freeze({quoteId:envelope.quote.quoteId,
   disposition:result.disposition,sourceEvidenceId:envelope.originalSourceEvidenceId,
   canExecute:false as const});
}

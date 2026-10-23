import {
 orderSniperFastlaneWork,evaluateSniperExit,
 type SniperQueuedItem,type SniperPositionState,type SniperExitQuote,type SniperExitPolicy,
 type SniperExitDecision,
} from '@jhadina/money-core'
import {runSniperPaperCycle} from './sniper-paper-cycle'
import type {SniperPublicRead} from './sniper-live-paper-feed'

/** LIVE-PAPER.07-.09: one bounded, sequential, manually commissioned tick.
 * Process unreconciled exits FIRST; never convert Dex public price into
 * executable sell-route evidence, a wallet order, or realized proceeds.
 */
export type SniperExitMonitorInput=Readonly<{
 workId:string;position:SniperPositionState;quote?:SniperExitQuote;
 policy:SniperExitPolicy;unresolvedPreviousExit?:boolean
}>
export type SniperEntryMonitorInput=Readonly<{
 workId:string;mint:string;originalPairAddress:string
 /** Independently supplied canonical SHARK + Money snapshot, NOT built from
  * a public DEX price. Must include the LIVE-PAPER fastlane admission gate. */
 canonicalPaper?:Parameters<typeof runSniperPaperCycle>[0]
}>
export type SniperPaperMonitorRecord=Readonly<{
 recordId:string;workId:string;observedAt:string;
 outcome:'EXIT_REVIEW'|'PUBLIC_PRICE_ONLY'|'MISSING_PUBLIC_PAIR'|
         'CHAIN_PROOF_REQUIRED'|'PAPER_RECORDED'|'NO_TRADE';
 reasonCodes:readonly string[];
 exitAction?:SniperExitDecision['action'];
 paperRunId?:string
 authority:'PAPER_RESEARCH_ONLY';canExecute:false;canSign:false;canCreditPurse:false
}>
export type SniperPaperMonitorStore=Readonly<{
 /** Implementations MUST enforce unique record ID + conflict detection and
  * durable commit BEFORE returning, or they are not accepted for 24/7 use. */
 append:(record:SniperPaperMonitorRecord)=>Promise<'INSERTED'|'REPLAY_IDENTICAL'>
}>
export type SniperPaperMonitorInput=Readonly<{
 now:string
 work:readonly SniperQueuedItem[]
 exits:readonly SniperExitMonitorInput[]
 entries:readonly SniperEntryMonitorInput[]
 maxPerTick:number
 maxEntryQueueMs:number
}>
const own=<T extends {workId:string}>(items:readonly T[])=>new Map(items.map(x=>[x.workId,x]))
const receipt=(workId:string,now:string,outcome:SniperPaperMonitorRecord['outcome'],
 codes:readonly string[],extra:Partial<Pick<SniperPaperMonitorRecord,'exitAction'|'paperRunId'>>={}):SniperPaperMonitorRecord=>
 Object.freeze({
  recordId:'sniper-paper:'+workId+':'+now,workId,observedAt:now,
  outcome,reasonCodes:Object.freeze([...codes]),...extra,
  authority:'PAPER_RESEARCH_ONLY',canExecute:false,canSign:false,canCreditPurse:false,
 })
export async function runSniperLivePaperTick(input:SniperPaperMonitorInput,deps:{
 readPublicPair:(mint:string,pairAddress:string)=>Promise<SniperPublicRead>
 store:SniperPaperMonitorStore
}){
 if(input.work.length>512||input.exits.length>512||input.entries.length>512){
  throw new Error('SNIPER_PAPER_TICK_BOUNDS_INVALID')
 }
 const plan=orderSniperFastlaneWork(input.work,{
  now:input.now,maxItems:input.maxPerTick,maxEntryQueueMs:input.maxEntryQueueMs,
 })
 const exits=own(input.exits),entries=own(input.entries)
 const recorded:SniperPaperMonitorRecord[]=[]
 for(const item of plan.ready){
  let row:SniperPaperMonitorRecord
  if(item.kind!=='RESEARCH_ENTRY'){
   const position=exits.get(item.workId)
   if(!position)throw new Error('SNIPER_PAPER_EXIT_STATE_REQUIRED')
   if(position.position.tokenAddress.trim()==='')throw new Error('SNIPER_PAPER_EXIT_TOKEN_INVALID')
   const decision=evaluateSniperExit({
    position:position.position,quote:position.quote,policy:position.policy,
    unresolvedPreviousExit:position.unresolvedPreviousExit,now:input.now,
   })
   row=receipt(item.workId,input.now,'EXIT_REVIEW',decision.reasonCodes,{
    exitAction:decision.action,
   })
  }else{
   const candidate=entries.get(item.workId)
   if(!candidate||!candidate.mint||!candidate.originalPairAddress){
    throw new Error('SNIPER_PAPER_ENTRY_STATE_REQUIRED')
   }
   const publicRead=await deps.readPublicPair(candidate.mint,candidate.originalPairAddress)
   if(publicRead.mint!==candidate.mint||publicRead.canTrade!==false||
     publicRead.authority!=='PUBLIC_RESEARCH_ONLY'){
    throw new Error('SNIPER_PAPER_FEED_AUTHORITY_INVALID')
   }
   if(publicRead.status!=='READ_ONLY_OBSERVED'||!publicRead.pair){
    row=receipt(item.workId,input.now,'MISSING_PUBLIC_PAIR',['EXACT_PAIR_NOT_PUBLICLY_OBSERVED'])
   }else if(!candidate.canonicalPaper||!candidate.canonicalPaper.fastlane||
     candidate.canonicalPaper.riskEvidence.proof!=='CHAIN_ATTESTED'){
    row=receipt(item.workId,input.now,'CHAIN_PROOF_REQUIRED',[
     'PUBLIC_PRICE_NOT_CHAIN_ATTESTATION','REAL_BUY_SELL_QUOTE_NOT_PROVIDED',
    ])
   }else{
    if(candidate.canonicalPaper.tokenAddress!==candidate.mint||
      candidate.canonicalPaper.now!==input.now||
      candidate.canonicalPaper.fastlane.selectedQuoteEvidenceId.startsWith('dex-public:')||
      candidate.canonicalPaper.fastlane.selectedQuoteEvidenceId===publicRead.pair.evidenceId){
      throw new Error('SNIPER_PAPER_IDENTITY_OR_PUBLIC_QUOTE_SUBSTITUTION')
    }
    const result=runSniperPaperCycle(candidate.canonicalPaper)
    row=receipt(item.workId,input.now,result.disposition==='PAPER_RECORDED'?'PAPER_RECORDED':'NO_TRADE',
      result.reasonCodes,result.paper?{paperRunId:result.paper.runId}:{})
   }
  }
  // Commit one result at a time, so a crash cannot falsely acknowledge later
  // work. Retry must be idempotent; divergent same-key payload is an error.
  await deps.store.append(row)
  recorded.push(row)
 }
 return Object.freeze({
  records:Object.freeze(recorded),
  deferred:Object.freeze([...plan.deferred]),
  expiredEntries:Object.freeze([...plan.expiredEntries]),
  authority:'PAPER_MONITOR_ONLY' as const,
  alwaysOn:false as const,canExecute:false as const,canSign:false as const,
  canCreditPurse:false as const,
 })
}

/** Opt-in process loop for a separately approved, persistent owner host.
 * Not called by Next.js routes or at module import. The host must supply a
 * durable store and abortable pacing; provider retries stop on failed ticks.
 */
export async function runSniperReadOnlyLoop(input:{
 maxCycles:number;minIntervalMs:number;signal:AbortSignal;
 tick:()=>Promise<unknown>;sleep:(ms:number,signal:AbortSignal)=>Promise<void>
}):Promise<Readonly<{completedCycles:number;aborted:boolean;authority:'PAPER_MONITOR_ONLY'}>>{
 if(!Number.isSafeInteger(input.maxCycles)||input.maxCycles<1||input.maxCycles>10000||
    !Number.isSafeInteger(input.minIntervalMs)||input.minIntervalMs<1000||input.minIntervalMs>60000){
  throw new Error('SNIPER_PAPER_LOOP_POLICY_INVALID')
 }
 let count=0
 while(count<input.maxCycles&&!input.signal.aborted){
  await input.tick()
  count++
  if(count<input.maxCycles&&!input.signal.aborted)await input.sleep(input.minIntervalMs,input.signal)
 }
 return Object.freeze({completedCycles:count,aborted:input.signal.aborted,authority:'PAPER_MONITOR_ONLY'})
}

import type {SupabaseClient} from '@supabase/supabase-js'

/**
 * Trust boundary: a GitHub production-scheduler OIDC-authenticated route may
 * import only hash-audited public research receipts prepared from the trusted
 * main-branch Python observer. There is NO launch time, creator identity,
 * LP-lock claim, sellability approval or Money execution permission here.
 */
const EXPERIMENT='JHADINA-MEME-20261013-7D-001'
const DIGEST=/^[a-f0-9]{64}$/
const COMMIT=/^[a-f0-9]{40}$/
const MINT=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/
const MAX_INGRESS=24
const WINDOW_START=Date.parse('2026-10-13T22:50:00Z')
const WINDOW_END=Date.parse('2026-10-20T22:50:00Z')
type Json=Record<string,unknown>
const object=(v:unknown):v is Json=>!!v&&typeof v==='object'&&!Array.isArray(v)
const requireString=(v:unknown,pattern:RegExp,code:string):string=>{
  if(typeof v!=='string'||!pattern.test(v))throw new Error(code)
  return v
}
const utc=(v:unknown,code:string):string=>{
  if(typeof v!=='string'||!v.endsWith('Z')||Number.isNaN(Date.parse(v)))throw new Error(code)
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(v))throw new Error(code)
  return v
}
const fail=(msg:string):never=>{throw new Error('SHARK_PAPER_INGRESS_'+msg)}
const safeNumber=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)&&n>=0
const types=new Set(['MARKET_OBSERVATION','SHARK_MONEY_PAPER_GUARD'])

export type PaperObservationRow=Readonly<{
 receipt_digest:string
 experiment_id:string
 event_kind:string
 chain_id:'solana'
 mint:string
 pool:string|null
 event_observed_at:string
 event_available_at:string
 source_git_commit:string
 source_ledger_head:string
 source_cycle_digest:string
 source_event_json:Json
 safety_status:'UNVERIFIED'
 money_disposition:'NO_TRADE'
 authority:'RESEARCH_ONLY'
 can_trade:false
 can_sign:false
 can_broadcast:false
}>

export function validatePaperIngress(payload:unknown, now=new Date()):readonly PaperObservationRow[]{
 if(!object(payload)||payload.version!=='SHARK-PAPER-INGRESS-01'
   ||payload.experimentId!==EXPERIMENT
   ||payload.authority!=='RESEARCH_ONLY'
   ||payload.canTrade!==false||payload.canSign!==false||payload.canBroadcast!==false)
   return fail('ENVELOPE_UNSAFE')
 const commit=requireString(payload.sourceDataCommit,COMMIT,'SHARK_PAPER_INGRESS_BAD_COMMIT')
 const head=requireString(payload.ledgerHeadDigest,DIGEST,'SHARK_PAPER_INGRESS_BAD_HEAD')
 const cycle=requireString(payload.cycleDigest,DIGEST,'SHARK_PAPER_INGRESS_BAD_CYCLE')
 const cycleAt=utc(payload.cycleAvailableAt,'SHARK_PAPER_INGRESS_BAD_CYCLE_TIME')
 const cycleMs=Date.parse(cycleAt)
 const nowMs=now.getTime()
 if(cycleMs<WINDOW_START||cycleMs>WINDOW_END||cycleMs>nowMs+30000||nowMs-cycleMs>2*3600*1000)
   return fail('STALE_OR_FUTURE_CYCLE')
 if(!Array.isArray(payload.events)||payload.events.length>MAX_INGRESS||payload.events.length<1)
   return fail('EVENT_BATCH_INVALID')
 if(!Number.isInteger(payload.totalEligibleInLastCycle)
   ||(payload.totalEligibleInLastCycle as number)<payload.events.length
   ||typeof payload.partialBatch!=='boolean')
   return fail('COVERAGE_INVALID')
 const rows:PaperObservationRow[]=[]
 const seen=new Set<string>()
 for(const item of payload.events){
   if(!object(item)||!types.has(String(item.type)))return fail('TYPE_INVALID')
   const digest=requireString(item.digest,DIGEST,'SHARK_PAPER_INGRESS_EVENT_DIGEST_INVALID')
   const prior=requireString(item.previousDigest,DIGEST,'SHARK_PAPER_INGRESS_PREVIOUS_DIGEST_INVALID')
   if(seen.has(digest)||prior===digest)return fail('DUPLICATE_OR_SELF_REFERENTIAL_RECEIPT')
   seen.add(digest)
   const mint=requireString(item.mint,MINT,'SHARK_PAPER_INGRESS_MINT_INVALID')
   const at=utc(item.availableAt,'SHARK_PAPER_INGRESS_AVAILABLE_AT_INVALID')
   const observed=utc(item.observedAt,'SHARK_PAPER_INGRESS_OBSERVED_AT_INVALID')
   if(Date.parse(observed)>Date.parse(at)||Date.parse(at)>nowMs+30000
      ||Date.parse(at)<WINDOW_START||Date.parse(at)>WINDOW_END)
      return fail('EVENT_CLOCK_INVALID')
   if(item.canTrade!==false||item.canSign===true||item.canBroadcast===true)
      return fail('EVENT_EXECUTION_FORBIDDEN')
   let pool:string|null=null
   if(item.type==='MARKET_OBSERVATION'){
     if(at!==cycleAt||item.securityStatus!=='UNVERIFIED'||!safeNumber(item.priceUsd)
       ||!safeNumber(item.liquidityUsd))
       return fail('MARKET_EVIDENCE_UNVERIFIED')
     pool=requireString(item.pair,MINT,'SHARK_PAPER_INGRESS_POOL_INVALID')
     if(!Array.isArray(item.flags)||item.flags.some(x=>typeof x!=='string'))
       return fail('MARKET_FLAGS_INVALID')
   }else{
     if(item.informationCutoff!==cycleAt||item.moneyApproval!=='ABSENT'
       ||item.disposition!=='NO_TRADE'||item.paperNotionalUsd!==0
       ||item.simulatedFill!=='NONE'||item.authority!=='RESEARCH_ONLY')
       return fail('MONEY_ABSTENTION_INVALID')
   }
   rows.push({
     receipt_digest:digest,experiment_id:EXPERIMENT,event_kind:String(item.type),
     chain_id:'solana',mint,pool,event_observed_at:observed,event_available_at:at,
     source_git_commit:commit,source_ledger_head:head,source_cycle_digest:cycle,
     source_event_json:item,safety_status:'UNVERIFIED',money_disposition:'NO_TRADE',
     authority:'RESEARCH_ONLY',can_trade:false,can_sign:false,can_broadcast:false,
   })
 }
 return Object.freeze(rows)
}

const sameOriginal=(row:any,input:PaperObservationRow):boolean=>
 row&&row.experiment_id===input.experiment_id&&row.event_kind===input.event_kind
 &&row.mint===input.mint&&row.pool===input.pool
 &&JSON.stringify(row.source_event_json)===JSON.stringify(input.source_event_json)
 // Same original event may be re-ingested under a later verified Git SHA/ledger
 // head; digest uniqueness is the stable dedup key, original bytes are fixed.
 &&row.event_available_at===input.event_available_at

export async function persistPaperIngress(client:SupabaseClient,rows:readonly PaperObservationRow[]){
 let inserted=0,replayed=0
 for(const row of rows){
   const result=await client.from('jhadina_shark_paper_observation_ingress')
     .insert(row).select('receipt_digest').maybeSingle()
   if(!result.error&&result.data){inserted++;continue}
   if(result.error?.code!=='23505')throw new Error('SHARK_PAPER_INGRESS_DB_WRITE_FAILED:'+String(result.error?.message??'unknown'))
   const old=await client.from('jhadina_shark_paper_observation_ingress')
     .select('experiment_id,event_kind,mint,pool,source_event_json,event_available_at')
     .eq('receipt_digest',row.receipt_digest).maybeSingle()
   if(old.error||!sameOriginal(old.data,row))
     throw new Error('SHARK_PAPER_INGRESS_CONFLICT_OR_READ_FAILED')
   replayed++
 }
 return Object.freeze({inserted,replayed,accepted:rows.length,
   authority:'RESEARCH_ONLY' as const,canTrade:false as const,
   canonicalActorGraphValidated:false as const,moneyIngressCreated:false as const})
}

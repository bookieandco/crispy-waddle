/**
 * BIZ-PURSE.15 operator-run atomic concurrency drill.
 * This is NOT a unit test or CI production gate. It only accepts a disposable
 * loopback PostgreSQL target after explicit opt-in and staged SQL application.
 * DO NOT supply an SWLC, production, staging, or cloud database URL.
 */
import pg from 'pg'
import {randomUUID} from 'node:crypto'
const {Client}=pg

function requireDisposableUrl(value:string|undefined):string{
 if(process.env.BIZ_PURSE_LOCAL_CONFIRMATION!=='YES_DISPOSABLE_DB_ONLY')
  throw new Error('BIZ_PURSE_15_EXPLICIT_LOCAL_CONFIRMATION_REQUIRED')
 if(!value)throw new Error('BIZ_PURSE_15_LOCAL_URL_MISSING')
 let u:URL
 try{u=new URL(value)}catch{throw new Error('BIZ_PURSE_15_LOCAL_URL_INVALID')}
 if(!['postgres:','postgresql:'].includes(u.protocol)||
    !['localhost','127.0.0.1','[::1]'].includes(u.hostname)||
    !/^biz_purse_recovery_[a-z0-9_]+$/.test(decodeURIComponent(u.pathname.slice(1)))||
    u.username!=='postgres'||!u.port||Number(u.port)<1025||
    [...u.searchParams.keys()].some(k=>k!=='sslmode')||
    (u.searchParams.has('sslmode')&&u.searchParams.get('sslmode')!=='disable'))
  throw new Error('BIZ_PURSE_15_DISPOSABLE_LOOPBACK_ONLY')
 return value
}
type RpcResult={outcome:string;ownerUserId:string;orderId:string;eventId:string;sequence:number}
export async function verifyDurableJournalPostgresRace():Promise<{
  status:'LOCAL_DISPOSABLE_CONCURRENCY_VERIFIED'
  attempted:2
  committed:1
  rejected:1
  replay:'EXACT_REPLAY'
  wrongOrderPaymentReuseBlocked:true
  productionCertified:false
}>{
 const url=requireDisposableUrl(process.env.BIZ_PURSE_DISPOSABLE_DATABASE_URL)
 const clients=[new Client({connectionString:url,ssl:false,connectionTimeoutMillis:5000}),
  new Client({connectionString:url,ssl:false,connectionTimeoutMillis:5000})]
 try{
  await Promise.all(clients.map(x=>x.connect()))
  const check=await clients[0].query<{db:string;role:string}>('select current_database() as db,current_user as role')
  if(!check.rows[0]?.db.startsWith('biz_purse_recovery_')||check.rows[0]?.role!=='postgres')
   throw new Error('BIZ_PURSE_15_DATABASE_ROLE_MISMATCH')
  const probe=await clients[0].query("select to_regprocedure('biz_purse_15_recovery.append_order_event_atomic(uuid,text,jsonb,bigint,text,text,text)') as fn")
  if(!probe.rows[0]?.fn)throw new Error('BIZ_PURSE_15_ATOMIC_RPC_NOT_INSTALLED')

  const owner=randomUUID(),order='biz-purse-15-race:'+randomUUID()
  const createdId='created:'+randomUUID(),timestamp=new Date().toISOString()
  const create={eventId:createdId,sequence:1,ownerUserId:owner,orderId:order,kind:'ORDER_CREATED',
   observedAt:timestamp,evidenceId:'local-fixture:'+randomUUID(),customerRef:'client:local',
   currency:'USD',amountMinor:'9900',synthetic:true}
  const sql='select biz_purse_15_recovery.append_order_event_atomic($1::uuid,$2::text,$3::jsonb,$4::bigint,$5::text,$6::text,$7::text) as receipt'
  const append=(client:pg.Client,event:Record<string,unknown>,prevSequence:number,prevId:string|null,
   provider:string|null=null,providerEventRef:string|null=null)=>
    client.query<{receipt:RpcResult}>(sql,[owner,event.orderId,JSON.stringify(event),prevSequence,prevId,provider,providerEventRef])
  const initial=await append(clients[0],create,0,null)
  if(initial.rows[0]?.receipt?.outcome!=='APPENDED')throw new Error('BIZ_PURSE_15_FIRST_APPEND_FAILED')
  const makePayment=(id:string)=>({
   eventId:'payment:'+id,sequence:2,ownerUserId:owner,orderId:order,kind:'PAYMENT_SETTLED',
   observedAt:timestamp,evidenceId:'synthetic:'+id,providerPaymentId:'pi:'+id,
   providerReadbackVerified:false,providerSignatureVerified:false,
   amountMinor:'9900',currency:'USD',synthetic:true,
  })
  const left=makePayment(randomUUID()),right=makePayment(randomUUID())
  const outcomes=await Promise.allSettled([
   append(clients[0],left,1,createdId,'local-fixture-provider','event:'+left.eventId),
   append(clients[1],right,1,createdId,'local-fixture-provider','event:'+right.eventId)
  ])
  const winners=outcomes.filter((x):x is PromiseFulfilledResult<pg.QueryResult<{receipt:RpcResult}>>=>x.status==='fulfilled')
  const losers=outcomes.filter(x=>x.status==='rejected')
  if(winners.length!==1||losers.length!==1||winners[0].value.rows[0]?.receipt?.outcome!=='APPENDED')
   throw new Error('BIZ_PURSE_15_CONCURRENCY_FENCE_FAILED')
  const winningEvent=outcomes[0].status==='fulfilled'?left:right
  const winningProviderRef='event:'+winningEvent.eventId
  const replay=await append(clients[0],winningEvent,1,createdId,'local-fixture-provider',winningProviderRef)
  if(replay.rows[0]?.receipt?.outcome!=='EXACT_REPLAY')throw new Error('BIZ_PURSE_15_IDEMPOTENT_REPLAY_FAILED')
  // Two independent orders must not reuse the same provider settlement.
  const orderB='biz-purse-15-second:'+randomUUID(),createB={...create,orderId:orderB,eventId:'created:'+randomUUID()}
  await append(clients[1],createB,0,null)
  const reused={...winningEvent,orderId:orderB,eventId:'payment:'+randomUUID()}
  let reuseBlocked=false
  try{await append(clients[1],reused,1,createB.eventId,'local-fixture-provider','event:'+reused.eventId)}
  catch{reuseBlocked=true}
  if(!reuseBlocked)throw new Error('BIZ_PURSE_15_CROSS_ORDER_PAYMENT_REUSE_ACCEPTED')
  const count=await clients[0].query<{n:string}>(
   'select count(*)::text as n from biz_purse_15_recovery.order_events where owner_user_id=$1 and order_id=$2',[owner,order])
  if(count.rows[0]?.n!=='2')throw new Error('BIZ_PURSE_15_APPEND_OR_REPLAY_COUNT_INCORRECT')
  return {status:'LOCAL_DISPOSABLE_CONCURRENCY_VERIFIED',attempted:2,committed:1,rejected:1,
   replay:'EXACT_REPLAY',wrongOrderPaymentReuseBlocked:true,productionCertified:false}
 }finally{await Promise.allSettled(clients.map(x=>x.end()))}
}
if(process.argv[1]?.endsWith('biz-purse-15-postgres-race.local.ts')){
 verifyDurableJournalPostgresRace().then(result=>console.log(JSON.stringify(result,null,2))).catch(e=>{
  console.error(e instanceof Error?e.message:String(e));process.exitCode=1
 })
}

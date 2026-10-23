import {createHash} from 'node:crypto'
import {open,readFile,readdir,lstat,realpath,rename,unlink} from 'node:fs/promises'
import {isAbsolute,join,resolve} from 'node:path'
import {assertDexSwapIntent,hashDexRuntime,type DexSwapIntent,type DexExecutionAttempt,type DexOnchainReceipt} from './solana-dex-runtime-contracts.js'
import {reviewSniperOnchainSettlement} from './sniper-live-canary-gate.js'

/** COFFER-ACCEPT.42-.43: crash-conservative single-writer RESEARCH receipts.
 * This is NOT a cross-host distributed transaction, signer permission, Money
 * PermitStore, budget reserve, or replacement for canonical canary state.
 * A crash leaves an exclusive lock and blocks automatic re-enrollment.
 */
export type CofferResearchReceipt=Readonly<{
 idempotencyKey:string;executionId:string;walletConnectionId:string
 intentHash:string;notionalMinor:string;tradingDay:string
 createdAt:string;updatedAt:string;guardVersion:number
 state:'RESERVED_RESEARCH'|'UNKNOWN_NEEDS_RECONCILIATION'|'OBSERVED_RECONCILED'
 signature?:string;settlementEvidenceIds?:readonly string[]
 authority:'COFFER_RESEARCH_RECORD_ONLY';canSign:false;canBroadcast:false
}>
export type CofferResearchGuard=Readonly<{
 version:number;observedAt:string;halted:boolean
 walletConnectionId:string;tradingDay:string
 unresolvedExecutionIds:readonly string[]
 submittedTodayMinor:bigint;lossTodayMinor:bigint
 authority:'CANONICAL_GUARD_SNAPSHOT_ONLY'
}>
export type CofferResearchPolicy=Readonly<{
 maxSingleMinor:bigint;maxDailySubmittedMinor:bigint;maxDailyLossMinor:bigint
 maxObservationAgeMs:number;authority:'RESEARCH_BUDGET_POLICY_ONLY'
}>
export type CofferResearchResult=Readonly<{
 status:'RESERVED_RESEARCH_ONLY'|'REPLAY_BLOCKED'|'BUDGET_OR_GUARD_BLOCKED'
 reasonCodes:readonly string[]
 receipt?:CofferResearchReceipt
 canSign:false;canSubmit:false;canBroadcast:false;canCreditPurse:false
 authority:'COFFER_RESEARCH_RESERVATION_ONLY'
}>
const digest=(s:string)=>createHash('sha256').update(s).digest('hex')
const fingerprint=(receipt:CofferResearchReceipt)=>digest(JSON.stringify(receipt))
const filename=(key:string)=>digest(key)+'.json'
const lockname='.sniper-coffer.lock'
const haltname='.sniper-coffer-halt.json'
const simple=(x:string)=>typeof x==='string'&&x.length>0&&x.length<=256&&!/[\r\n\x00]/.test(x)
function validate(r:CofferResearchReceipt){
 if(!simple(r.idempotencyKey)||!simple(r.executionId)||!simple(r.walletConnectionId)||
  !/^[0-9a-f]{64}$/.test(r.intentHash)||!/^\d+$/.test(r.notionalMinor)||
  BigInt(r.notionalMinor)<=0n||!/^\d{4}-\d{2}-\d{2}$/.test(r.tradingDay)||
  !Number.isFinite(Date.parse(r.createdAt))||!Number.isFinite(Date.parse(r.updatedAt))||
  !Number.isSafeInteger(r.guardVersion)||r.guardVersion<0||
  !['RESERVED_RESEARCH','UNKNOWN_NEEDS_RECONCILIATION','OBSERVED_RECONCILED'].includes(r.state)||
  r.authority!=='COFFER_RESEARCH_RECORD_ONLY'||r.canSign!==false||r.canBroadcast!==false||
  Object.keys(r).some(k=>![
   'idempotencyKey','executionId','walletConnectionId','intentHash','notionalMinor',
   'tradingDay','createdAt','updatedAt','guardVersion','state','signature',
   'settlementEvidenceIds','authority','canSign','canBroadcast'].includes(k))
 )throw Error('COFFER_RESEARCH_RECORD_INVALID')
}
async function privateRoot(root:string){
 if(!isAbsolute(root)||resolve(root)!==root)throw Error('COFFER_RESEARCH_ROOT_INVALID')
 const s=await lstat(root)
 if(!s.isDirectory()||s.isSymbolicLink()||(s.mode&0o077)!==0||
    typeof process.getuid==='function'&&s.uid!==process.getuid()||
    await realpath(root)!==root)throw Error('COFFER_RESEARCH_PRIVATE_VOLUME_REQUIRED')
}
async function loadRecord(root:string,file:string):Promise<CofferResearchReceipt>{
 const path=join(root,file),s=await lstat(path)
 if(!s.isFile()||s.isSymbolicLink()||(s.mode&0o077)!==0||s.size>16384||
    typeof process.getuid==='function'&&s.uid!==process.getuid())
  throw Error('COFFER_RESEARCH_FILE_UNSAFE')
 const raw=await readFile(path,'utf8')
 const obj:unknown=JSON.parse(raw)
 if(!obj||typeof obj!=='object'||Array.isArray(obj))throw Error('COFFER_RESEARCH_CORRUPT')
 const parsed=obj as {hash?:unknown;receipt?:unknown}
 if(!parsed.receipt||typeof parsed.receipt!=='object'||Array.isArray(parsed.receipt))throw Error('COFFER_RESEARCH_CORRUPT')
 const receipt=parsed.receipt as CofferResearchReceipt
 validate(receipt)
 if(parsed.hash!==fingerprint(receipt)||filename(receipt.idempotencyKey)!==file)
  throw Error('COFFER_RESEARCH_CHECKSUM_MISMATCH')
 return receipt
}
async function readAll(root:string):Promise<CofferResearchReceipt[]>{
 const files=await readdir(root)
 if(files.length>10001)throw Error('COFFER_RESEARCH_CAPACITY')
 const selected=files.filter(f=>f.endsWith('.json')&&f!==haltname)
 if(selected.some(f=>!/^[a-f0-9]{64}\.json$/.test(f)))throw Error('COFFER_RESEARCH_UNRECOGNIZED_FILE')
 const out:CofferResearchReceipt[]=[]
 for(const file of selected)out.push(await loadRecord(root,file))
 return out
}
async function syncDir(root:string){
 const f=await open(root,'r')
 try{await f.sync()}finally{await f.close()}
}
async function persist(root:string,receipt:CofferResearchReceipt){
 validate(receipt)
 const payload=JSON.stringify({hash:fingerprint(receipt),receipt})
 if(payload.length>16384)throw Error('COFFER_RESEARCH_OVERSIZE')
 const dest=join(root,filename(receipt.idempotencyKey))
 const temp=join(root,'.pending-'+digest(receipt.idempotencyKey+':'+receipt.updatedAt+':'+receipt.state))
 const f=await open(temp,'wx',0o600)
 try{await f.writeFile(payload);await f.sync()}finally{await f.close()}
 // On crash, orphan .pending- files cause a stop until manual review.
 await rename(temp,dest)
 await syncDir(root)
}
async function getHalt(root:string):Promise<boolean>{
 try{
  const f=join(root,haltname),s=await lstat(f)
  if(!s.isFile()||s.isSymbolicLink()||(s.mode&0o077)!==0||s.size>2048)
   throw Error('COFFER_RESEARCH_HALT_UNSAFE')
  return true
 }catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return false;throw e}
}
async function exclusive<T>(root:string,work:()=>Promise<T>):Promise<T>{
 await privateRoot(root)
 // Orphaned crash lease prevents automatic resume, even after service restart.
 const files=await readdir(root)
 if(files.some(f=>f.startsWith('.pending-')))throw Error('COFFER_RESEARCH_ORPHANED_WRITE')
 const file=join(root,lockname),lease=await open(file,'wx',0o600)
 try{
  await lease.writeFile(JSON.stringify({pid:process.pid,kind:'RESEARCH_EXCLUSIVE_NO_SIGN',canSign:false}))
  await lease.sync()
 }finally{await lease.close()}
 await syncDir(root)
 try{return await work()}
 finally{await unlink(file);await syncDir(root)}
}
const result=(status:CofferResearchResult['status'],reasonCodes:readonly string[],
 receipt?:CofferResearchReceipt):CofferResearchResult=>Object.freeze({
 status,reasonCodes:Object.freeze([...reasonCodes]),...(receipt?{receipt}:{}),
 canSign:false,canSubmit:false,canBroadcast:false,canCreditPurse:false,
 authority:'COFFER_RESEARCH_RESERVATION_ONLY',
})
export async function reserveSniperCofferResearch(input:{
 root:string;intent:DexSwapIntent;guard:CofferResearchGuard
 policy:CofferResearchPolicy;now:string
}):Promise<CofferResearchResult>{
 return exclusive(input.root,async()=>{
  const {intent:i,guard:g,policy:p}=input
  const now=Date.parse(input.now),observed=Date.parse(g.observedAt)
  try{assertDexSwapIntent(i)}catch{return result('BUDGET_OR_GUARD_BLOCKED',['INVALID_MONEY_INTENT'])}
  if(i.leg!=='ENTRY')return result('BUDGET_OR_GUARD_BLOCKED',['ENTRY_ONLY_COFFFER_RESEARCH'])
  if(!Number.isFinite(now)||!Number.isFinite(observed)||now<observed||
     !Number.isSafeInteger(p.maxObservationAgeMs)||p.maxObservationAgeMs<1||
     p.maxSingleMinor<=0n||p.maxDailySubmittedMinor<=0n||p.maxDailyLossMinor<=0n||
     p.authority!=='RESEARCH_BUDGET_POLICY_ONLY'||
     g.authority!=='CANONICAL_GUARD_SNAPSHOT_ONLY'||
     !Number.isSafeInteger(g.version)||g.version<0||!/^\d{4}-\d{2}-\d{2}$/.test(g.tradingDay)||
     g.tradingDay!==input.now.slice(0,10)||
     g.walletConnectionId!==i.walletConnectionId||
     g.submittedTodayMinor<0n||g.lossTodayMinor<0n)
   return result('BUDGET_OR_GUARD_BLOCKED',['GUARD_OR_POLICY_INVALID'])
  if(await getHalt(input.root)||g.halted||g.unresolvedExecutionIds.length||
     now-observed>p.maxObservationAgeMs)
   return result('BUDGET_OR_GUARD_BLOCKED',['HALTED_STALE_OR_UNKNOWN_EXECUTION'])
  const all=await readAll(input.root)
  if(all.some(r=>r.idempotencyKey===i.idempotencyKey||r.executionId===i.executionId))
   return result('REPLAY_BLOCKED',['DUPLICATE_IDEMPOTENCY_OR_EXECUTION'])
  if(all.some(r=>r.state!=='OBSERVED_RECONCILED'))
   return result('BUDGET_OR_GUARD_BLOCKED',['UNRESOLVED_LOCAL_ATTEMPT'])
  const day=all.filter(r=>r.tradingDay===g.tradingDay&&r.walletConnectionId===i.walletConnectionId)
  const spent=day.reduce((total,r)=>total+BigInt(r.notionalMinor),0n)
  if(i.notionalMinor>p.maxSingleMinor||
     (spent>g.submittedTodayMinor?spent:g.submittedTodayMinor)+i.notionalMinor>p.maxDailySubmittedMinor||
     g.lossTodayMinor>=p.maxDailyLossMinor)
   return result('BUDGET_OR_GUARD_BLOCKED',['OWNER_RESEARCH_CAP_EXCEEDED'])
  const receipt:CofferResearchReceipt=Object.freeze({
   idempotencyKey:i.idempotencyKey,executionId:i.executionId,
   walletConnectionId:i.walletConnectionId,intentHash:hashDexRuntime(i),
   notionalMinor:i.notionalMinor.toString(),tradingDay:g.tradingDay,
   createdAt:input.now,updatedAt:input.now,guardVersion:g.version,
   state:'RESERVED_RESEARCH',authority:'COFFER_RESEARCH_RECORD_ONLY',
   canSign:false,canBroadcast:false,
  })
  await persist(input.root,receipt)
  return result('RESERVED_RESEARCH_ONLY',[],receipt)
 })
}
export async function markSniperCofferUnknown(input:{
 root:string;idempotencyKey:string;now:string
}):Promise<CofferResearchReceipt>{
 return exclusive(input.root,async()=>{
  const r=await loadRecord(input.root,filename(input.idempotencyKey))
  if(r.state!=='RESERVED_RESEARCH')throw Error('COFFER_RESEARCH_UNKNOWN_TRANSITION_BLOCKED')
  const next={...r,state:'UNKNOWN_NEEDS_RECONCILIATION' as const,updatedAt:input.now}
  await persist(input.root,next)
  return Object.freeze(next)
 })
}
/** Canonical runtime must ALREADY have reconciled the entry/exit.
 * This stores a read-only observation, never releases permits or credits
 * funds. A confirmed RPC view can still be rolled back; separately require
 * true finality for real custody release. */
export async function recordSniperCofferSettlementObservation(input:{
 root:string;intent:DexSwapIntent;attempt:DexExecutionAttempt
 onchain:DexOnchainReceipt;now:string
}):Promise<CofferResearchReceipt>{
 return exclusive(input.root,async()=>{
  if(await getHalt(input.root))throw Error('COFFER_RESEARCH_HALTED')
  const receipt=await loadRecord(input.root,filename(input.intent.idempotencyKey))
  if(receipt.state!=='RESERVED_RESEARCH'&&
     receipt.state!=='UNKNOWN_NEEDS_RECONCILIATION')
   throw Error('COFFER_RESEARCH_SETTLEMENT_REPLAY_BLOCKED')
  if(receipt.executionId!==input.intent.executionId||
     receipt.intentHash!==hashDexRuntime(input.intent)||
     receipt.walletConnectionId!==input.intent.walletConnectionId)
   throw Error('COFFER_RESEARCH_ORIGINAL_INTENT_MISMATCH')
  const review=reviewSniperOnchainSettlement({
   intent:input.intent,attempt:input.attempt,onchain:input.onchain,
  })
  if(review.state!=='MATCHED_OBSERVATION'||review.reasonCodes.length>0||
     input.attempt.state!=='RECONCILED'||!Number.isSafeInteger(input.onchain.slot)||
     (input.onchain.slot??0)<=0||!input.onchain.evidenceIds.length||
     !Number.isFinite(Date.parse(input.now))||
     Date.parse(input.now)<Date.parse(receipt.updatedAt))
   throw Error('COFFER_RESEARCH_CANONICAL_SETTLEMENT_UNVERIFIED')
  const updated:CofferResearchReceipt=Object.freeze({
   ...receipt,state:'OBSERVED_RECONCILED',updatedAt:input.now,
   signature:input.onchain.signature,
   settlementEvidenceIds:Object.freeze([...input.onchain.evidenceIds]),
  })
  await persist(input.root,updated)
  return updated
 })
}
export async function haltSniperCofferResearch(input:{
 root:string;reason:string;now:string
}):Promise<Readonly<{halted:true;canSign:false}>>{
 return exclusive(input.root,async()=>{
  if(!simple(input.reason)||!Number.isFinite(Date.parse(input.now)))
   throw Error('COFFER_RESEARCH_HALT_REASON_INVALID')
  if(!await getHalt(input.root)){
   const f=await open(join(input.root,haltname),'wx',0o600)
   try{await f.writeFile(JSON.stringify({reason:input.reason,at:input.now,canSign:false}));await f.sync()}
   finally{await f.close()}
   await syncDir(input.root)
  }
  return Object.freeze({halted:true,canSign:false})
 })
}
export async function recoverSniperCofferResearch(root:string):Promise<Readonly<{
 outstanding:readonly CofferResearchReceipt[]
 observedReconciled:number;halted:boolean
 canSign:false;canRetry:false;canCreditPurse:false
 authority:'COFFER_RESEARCH_RECOVERY_ONLY'
}>>{
 await privateRoot(root)
 // Do not bypass or auto-remove an orphan lock. A crash may have left
 // signed or unknown execution work outside this research-only ledger.
 const files=await readdir(root)
 if(files.includes(lockname)||files.some(f=>f.startsWith('.pending-')))
  throw Error('COFFER_RESEARCH_OPERATOR_RECONCILIATION_REQUIRED')
 const all=await readAll(root)
 return Object.freeze({
  outstanding:Object.freeze(all.filter(r=>r.state!=='OBSERVED_RECONCILED')),
  observedReconciled:all.filter(r=>r.state==='OBSERVED_RECONCILED').length,
  halted:await getHalt(root),canSign:false,canRetry:false,canCreditPurse:false,
  authority:'COFFER_RESEARCH_RECOVERY_ONLY',
 })
}

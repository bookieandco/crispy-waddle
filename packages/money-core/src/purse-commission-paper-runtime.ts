import {buildAutonomousPursePaperCycle,type PursePaperCycle} from './purse-paper-autonomy.js'
import type {PostgresPursePaperStore,PursePaperLedgerReadback} from './postgres-purse-paper-store.js'

type CycleInputs=Omit<Parameters<typeof buildAutonomousPursePaperCycle>[0],'lease'|'createdAt'|'expiresAt'>
export type PursePaperSourceReceipt=Readonly<{
 providerId:string
 rightsEvidenceIds:readonly string[]
 provenanceEvidenceIds:readonly string[]
 pointInTimeAvailableAt:string
 evidenceClass:'INDEPENDENT_PROVIDER_READBACK'
 synthetic:false
 feedConnected:true
 authority:'SOURCE_EVIDENCE_ONLY'
 canExecute:false
}>
export type PurseCommissionPaperTickReceipt=Readonly<{
 cycleId:string
 charterId:string
 writeStatus:'INSERTED'|'REPLAY'
 financialAuthority:'NONE'
 evidenceClass:'SINGLE_WORKER_WRITE_AND_READBACK'
 economicSha256:string
 storeReadback:PursePaperLedgerReadback
 createdAt:string
 sourceEvidenceIds:readonly string[]
 lineageMode:'NEW_FORWARD_ONLY'|'RESTORED_ORIGINAL'
 canExecute:false
 canMoveMoney:false
 canSign:false
 canBroadcast:false
 provesIndependentDurability:false
 provesExternalProviderAuthenticity:false
}>
const valid=(x:string)=>!!x&&!Number.isNaN(Date.parse(x))
/**
 * One bounded paper tick; the worker supplies independently authenticated market/portfolio observations.
 * This function cannot make provider calls, send orders, sign transactions or authorize payments.
 * A same-worker SQL readback is a necessary check but NOT independent durability proof.
 */
export async function runPurseCommissionPaperTick(input:{
 store:Pick<PostgresPursePaperStore,'acquireLease'|'appendOnce'|'readBack'>
 workerId:string
 ownerUserId:string
 now:string
 snapshot:CycleInputs
 source:PursePaperSourceReceipt
 lineageMode:'NEW_FORWARD_ONLY'|'RESTORED_ORIGINAL'
 forwardLineageIsolated:boolean
}):Promise<PurseCommissionPaperTickReceipt>{
 const x=input,at=Date.parse(x.now)
 if(!x.workerId?.trim()||!x.ownerUserId?.trim()||!valid(x.now)||!valid(x.snapshot.informationCutoff)||
   at<Date.parse(x.snapshot.informationCutoff)||at-Date.parse(x.snapshot.informationCutoff)>120000)throw new Error('PURSE_PAPER_TICK_TIME_INVALID')
 if(x.snapshot.charter.userId!==x.ownerUserId||
   !x.snapshot.capital.evidenceIds.length||!x.snapshot.treasury.evidenceIds.length||
   !x.snapshot.portfolio.evidenceIds.length)throw new Error('PURSE_PAPER_TICK_OWNER_OR_SOURCE_INVALID')
 if(!x.source||x.source.synthetic!==false||x.source.feedConnected!==true||
   x.source.evidenceClass!=='INDEPENDENT_PROVIDER_READBACK'||x.source.authority!=='SOURCE_EVIDENCE_ONLY'||
   x.source.canExecute!==false||!x.source.providerId?.trim()||
   !x.source.provenanceEvidenceIds.length||!x.source.rightsEvidenceIds.length||
   !valid(x.source.pointInTimeAvailableAt)||Date.parse(x.source.pointInTimeAvailableAt)>Date.parse(x.snapshot.informationCutoff))
   throw new Error('PURSE_PAPER_PROVIDER_READBACK_REQUIRED')
 if(x.lineageMode==='NEW_FORWARD_ONLY'&&!x.forwardLineageIsolated)throw new Error('PURSE_PAPER_ORIGINAL_HISTORY_CONTAMINATION')
 const end=new Date(at+90000).toISOString()
 const fence=await x.store.acquireLease({charterId:x.snapshot.charter.charterId,workerId:x.workerId,acquiredAt:x.now,
  expiresAt:end,evidenceIds:[...x.source.provenanceEvidenceIds,...x.source.rightsEvidenceIds]})
 const cycle:PursePaperCycle=buildAutonomousPursePaperCycle({...x.snapshot,lease:fence,createdAt:x.now,expiresAt:new Date(at+60000).toISOString()})
 const writeStatus=await x.store.appendOnce(cycle)
 const storeReadback=await x.store.readBack(cycle)
 if(!storeReadback.matching||storeReadback.cycleId!==cycle.cycleId||storeReadback.ownerUserId!==x.ownerUserId||
   storeReadback.economicSha256.length!==64)throw new Error('PURSE_PAPER_TICK_READBACK_INVALID')
 return Object.freeze({
  cycleId:cycle.cycleId,charterId:cycle.charterId,writeStatus,financialAuthority:'NONE',
  evidenceClass:'SINGLE_WORKER_WRITE_AND_READBACK',economicSha256:storeReadback.economicSha256,storeReadback,
  createdAt:x.now,sourceEvidenceIds:Object.freeze([...new Set([...x.source.provenanceEvidenceIds,...x.source.rightsEvidenceIds])].sort()),
  lineageMode:x.lineageMode,canExecute:false,canMoveMoney:false,canSign:false,canBroadcast:false,
  provesIndependentDurability:false,provesExternalProviderAuthenticity:false,
 })
}
/** No data, no tick: do not fabricate market quotes or balances to keep watchdog "green". */
export function createPurseCommissionUnavailableReceipt(why:string):Readonly<{
 status:'BLOCKED';reasonCode:string;canExecute:false
}>{
 const allowed=new Set(['DATABASE_UNAVAILABLE','REAL_SOURCE_UNAVAILABLE','OWNER_AUTH_NOT_VERIFIED','BACKUP_UNVERIFIED','LEASE_UNAVAILABLE','OTHER'])
 return Object.freeze({status:'BLOCKED',reasonCode:allowed.has(why)?why:'OTHER',canExecute:false})
}

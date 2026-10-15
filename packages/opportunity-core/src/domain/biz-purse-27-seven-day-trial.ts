import {createHash} from 'node:crypto'
/** BIZ-PURSE.27 — planned multi-day host proof review; not a daemon. */
export type UnattendedDayReceipt=Readonly<{
 dateUtc:string;ownerUserId:string;hostId:string;gitSha:string;
 tickReceiptId:string;restartTestReceiptId:string;immutableJournalDigest:string;
 realPhoneReadback:boolean;backupsRestored:boolean;errorsUnresolved:number
}>
export function reviewSevenDayHostTrial(input:Readonly<{
 ownerUserId:string;hostId:string;headSha:string;days:readonly UnattendedDayReceipt[];
 emergencyStopTested:boolean;noUnapprovedChargesObserved:boolean
}>){
 const reasons:string[]=[],dates=new Set<string>(),receipts=new Set<string>()
 if(!input.ownerUserId||!input.hostId||!/^[a-f0-9]{40}$/.test(input.headSha))
  throw Error('BIZ_PURSE_27_OWNER_HOST_SHA_INVALID')
 if(input.days.length!==7)reasons.push('SEVEN_DAY_TRIAL_REQUIRED')
 for(const d of input.days){
  if(!d||d.ownerUserId!==input.ownerUserId||d.hostId!==input.hostId||d.gitSha!==input.headSha||
   !/^\d{4}-\d{2}-\d{2}$/.test(d.dateUtc)||!Number.isFinite(Date.parse(d.dateUtc+'T00:00:00Z'))||
   !d.tickReceiptId||!d.restartTestReceiptId||!/^[a-f0-9]{64}$/.test(d.immutableJournalDigest)||
   !Number.isSafeInteger(d.errorsUnresolved)||d.errorsUnresolved<0)
   throw Error('BIZ_PURSE_27_DAILY_RECEIPT_INVALID')
  if(dates.has(d.dateUtc)||receipts.has(d.tickReceiptId))reasons.push('DAY_OR_RECEIPT_REUSED')
  if(!d.realPhoneReadback||!d.backupsRestored||d.errorsUnresolved>0)reasons.push('RUNTIME_RECOVERY_EVIDENCE_INCOMPLETE')
  dates.add(d.dateUtc);receipts.add(d.tickReceiptId)
 }
 const sorted=[...dates].sort()
 if(sorted.length===7){
  for(let i=1;i<sorted.length;i++){
   if((Date.parse(sorted[i]+'T00:00:00Z')-Date.parse(sorted[i-1]+'T00:00:00Z'))!==86400000)
    reasons.push('TRIAL_DATES_NOT_CONTIGUOUS')
  }
 }
 if(!input.emergencyStopTested)reasons.push('EMERGENCY_STOP_TEST_MISSING')
 if(!input.noUnapprovedChargesObserved)reasons.push('UNAPPROVED_COST_AUDIT_MISSING')
 return Object.freeze({status:reasons.length?'BLOCKED' as const:'UNATTESTED_TRIAL_REVIEW_ONLY' as const,
  reasons:Object.freeze([...new Set(reasons)]),
  reviewDigest:createHash('sha256').update(JSON.stringify(input)).digest('hex'),
  authority:'UNTRUSTED_HOST_RECEIPT_REVIEW_ONLY' as const,actualSevenDaysIndependentlyVerified:false as const,
  unattendedProductionCertified:false as const,canDeploy:false as const,canSpend:false as const,
  canRunCloudWorker:false as const})
}

import type {PursePaperLedgerReadback} from './postgres-purse-paper-store.js'
import type {PurseLearningInfluence} from './purse-paper-learning-evaluation.js'
import type {PursePaperPaydayReceipt} from './purse-paper-payday-reconciliation.js'

export type PursePaperRunReceipt=Readonly<{
 cycleId:string
 watchdogId:string
 startedAt:string
 completedAt:string
 readback:PursePaperLedgerReadback
 persistedAfterWorkerRestart:boolean
 pointInTimeSource:'REAL_PROVIDER'|'SYNTHETIC'|'UNKNOWN'
 simulatedFillsVerified:boolean
 feesAndSlippageModeled:boolean
 noLiveOrders:true
 evidenceIds:readonly string[]
}>
export type PursePaperHorizonReceipt=Readonly<{
 decisionId:string
 horizon:'15M'|'1H'|'4H'|'24H'|'3D'|'7D'
 decidedAt:string
 observedAt:string
 providerSource:'REAL_PROVIDER'|'SYNTHETIC'|'UNKNOWN'
 evidenceIds:readonly string[]
 }>
export type PursePaperCertification=Readonly<{
 status:'BLOCKED'|'EXTERNAL_REVIEW_REQUIRED'
 blockers:readonly string[]
 documentedCycleCount:number
 horizonCount:number
 originalLedgerRestored:boolean
 paperCertificationIssued:false
 liveFundingCertified:false
 liveTradingCertified:false
 authority:'CERTIFICATION_REVIEW_ONLY'
 canExecute:false
}>
const horizons={ '15M':900000,'1H':3600000,'4H':14400000,'24H':86400000,'3D':259200000,'7D':604800000 } as const
const time=(x:string)=>Date.parse(x)
export function reviewPursePaperCertification(x:{
 cycles:readonly PursePaperRunReceipt[]
 horizons:readonly PursePaperHorizonReceipt[]
 learningInfluence?:PurseLearningInfluence
 payday?:PursePaperPaydayReceipt
 durableDbIndependentReadback:boolean
 encryptedDriveBackupRestored:boolean
 originalLedgerRestored:boolean
 lineageMode?:'RESTORED_ORIGINAL'|'NEW_FORWARD_ONLY'
 forwardOnlyHistoryIsolated?:boolean
 workerGoogleOAuthVerified:boolean
 providerRightsConfirmed:boolean
 reviewedAt:string
}):PursePaperCertification{
 const reasons:string[]=[]
 if(!Number.isFinite(time(x.reviewedAt)))throw new Error('PURSE_PAPER_CERT_REVIEW_TIME_INVALID')
 if(!x.durableDbIndependentReadback)reasons.push('DURABLE_DATABASE_NOT_INDEPENDENTLY_VERIFIED')
 if(!x.encryptedDriveBackupRestored||!x.workerGoogleOAuthVerified)reasons.push('DRIVE_ENCRYPTED_RESTORE_OR_WORKER_OAUTH_MISSING')
 if(x.lineageMode==='NEW_FORWARD_ONLY'){
  if(!x.forwardOnlyHistoryIsolated||x.originalLedgerRestored)reasons.push('NEW_HISTORY_NOT_SEPARATED_FROM_ORIGINAL')
 }else if(!x.originalLedgerRestored)reasons.push('ORIGINAL_LEDGER_NOT_RECOVERED')
 if(!x.providerRightsConfirmed)reasons.push('PROVIDER_DATA_RIGHTS_UNVERIFIED')
 const cycles=[...x.cycles].sort((a,b)=>a.completedAt.localeCompare(b.completedAt))
 if(cycles.length<3||new Set(cycles.map(c=>c.cycleId)).size!==cycles.length||
  new Set(cycles.map(c=>c.watchdogId)).size!==cycles.length)reasons.push('THREE_UNIQUE_WATCHDOG_CYCLES_MISSING')
 if(cycles.length>=3&&time(cycles[cycles.length-1]!.completedAt)-time(cycles[0]!.completedAt)<1800000)reasons.push('WATCHDOG_WINDOW_UNDER_30_MINUTES')
 if(cycles.some(c=>!Number.isFinite(time(c.startedAt))||!Number.isFinite(time(c.completedAt))||
  c.startedAt>c.completedAt||c.completedAt>x.reviewedAt||!c.readback.matching||c.readback.cycleId!==c.cycleId||
  c.readback.authority!=='PAPER_LEDGER_READBACK_ONLY'||c.readback.canExecute!==false||
  !c.persistedAfterWorkerRestart||c.pointInTimeSource!=='REAL_PROVIDER'||!c.simulatedFillsVerified||
  !c.feesAndSlippageModeled||c.noLiveOrders!==true||!c.evidenceIds.length))reasons.push('CYCLE_RECEIPT_FAILED')
 const observed=new Set<string>()
 for(const h of x.horizons){
  const key=h.decisionId+':'+h.horizon
  if(observed.has(key))reasons.push('HORIZON_DUPLICATE')
  observed.add(key)
  if(!h.decisionId||!h.evidenceIds.length||h.providerSource!=='REAL_PROVIDER'||
    !Number.isFinite(time(h.decidedAt))||!Number.isFinite(time(h.observedAt))||
    time(h.observedAt)>time(x.reviewedAt)||time(h.observedAt)<time(h.decidedAt)+horizons[h.horizon])reasons.push('HORIZON_EVIDENCE_INVALID')
 }
 if(!Object.keys(horizons).every(h=>x.horizons.some(y=>y.horizon===h)))reasons.push('SIX_MATURED_HORIZONS_MISSING')
 if(!x.learningInfluence||x.learningInfluence.authority!=='PAPER_LEARNING_COMPARISON_ONLY'||
   x.learningInfluence.canExecute!==false||!x.learningInfluence.evidenceIds.length)reasons.push('OUT_OF_SAMPLE_LEARNING_COMPARISON_MISSING')
 if(!x.payday||x.payday.status!=='PAPER_TIED_OUT'||x.payday.authority!=='PAPER_PAYDAY_RECONCILIATION_ONLY'||
   x.payday.canMoveMoney!==false||x.payday.provesRealSettlement!==false)reasons.push('PAPER_PAYDAY_NOT_RECONCILED')
 return Object.freeze({status:reasons.length?'BLOCKED':'EXTERNAL_REVIEW_REQUIRED',blockers:Object.freeze([...new Set(reasons)].sort()),
  documentedCycleCount:cycles.length,horizonCount:x.horizons.length,originalLedgerRestored:x.originalLedgerRestored,
  paperCertificationIssued:false,liveFundingCertified:false,liveTradingCertified:false,authority:'CERTIFICATION_REVIEW_ONLY',canExecute:false})
}

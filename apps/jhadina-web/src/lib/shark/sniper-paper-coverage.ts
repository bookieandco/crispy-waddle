import type {SniperPaperMonitorRecord} from './sniper-live-paper-monitor'

/** LIVE-PAPER.CONTINUITY.14: audit only previously committed local paper receipts.
 * This is NOT full chain-launch coverage, actual onchain realized P&L,
 * a hosted monitor heartbeat, or wallet permission.
 */
export type SniperPaperCoverage=Readonly<{
 version:'SHARK-SNIPER.CONTINUITY.14'
 recordedDecisions:number
 recordedEntryExpired:number
 recordedPaperCycles:number
 recordedNoTrades:number
 recordedMissingProofs:number
 recordedExitReviews:number
 exitReviewsNeedingFollowup:number
 exitWorkIdsNeedingFollowup:readonly string[]
 latestPaperReceiptAt?:string
 newestReceiptAgeMs?:number
 authority:'JOURNALED_PAPER_ONLY'
 sourceLaunchCoverage:'UNKNOWN'
 liveExecution:'NOT_AUTHORIZED'
 alwaysOnCertified:false
 canCreditPurse:false
 canTrade:false
}>
const allowed=new Set(['recordId','workId','observedAt','outcome','reasonCodes',
 'exitAction','paperRunId','authority','canExecute','canSign','canCreditPurse'])
const inspect=(record:SniperPaperMonitorRecord,cutoff:number)=>{
 if(Object.keys(record).some(key=>!allowed.has(key)))throw Error('SNIPER_PAPER_COVERAGE_PROVENANCE_INVALID')
 const time=Date.parse(record.observedAt)
 if(!Number.isFinite(time)||time>cutoff||
  record.recordId!=='sniper-paper:'+record.workId+':'+record.observedAt||
  record.canExecute!==false||record.canSign!==false||
  record.canCreditPurse!==false||record.authority!=='PAPER_RESEARCH_ONLY'){
  throw Error('SNIPER_PAPER_COVERAGE_PROVENANCE_INVALID')
 }
 return time
}
const requiresFollowup=new Set(['EXIT_ROUTE_MISSING','UNRESOLVED_PREVIOUS_ATTEMPT'])
/** Selected latest-by-(workId,timestamp) snapshots; identical replay cannot
 * manufacture an additional independent decision. A conflicting replay fails.
 * Zero journaled records do NOT imply zero real launches/positions.
 */
export function summarizeSniperPaperCoverage(
 records:readonly SniperPaperMonitorRecord[],asOf:string,
):SniperPaperCoverage{
 const cutoff=Date.parse(asOf)
 if(!Number.isFinite(cutoff)||records.length>100000){
  throw Error('SNIPER_PAPER_COVERAGE_INPUT_INVALID')
 }
 const ids=new Map<string,SniperPaperMonitorRecord>()
 const latest=new Map<string,SniperPaperMonitorRecord>()
 let newest=-Infinity
 for(const record of records){
  const t=inspect(record,cutoff)
  const same=ids.get(record.recordId)
  if(same){
   if(JSON.stringify(same)!==JSON.stringify(record))throw Error('SNIPER_PAPER_COVERAGE_REPLAY_CONFLICT')
   continue
  }
  ids.set(record.recordId,record)
  const old=latest.get(record.workId)
  if(!old||Date.parse(old.observedAt)<t||
      Date.parse(old.observedAt)===t&&old.recordId<record.recordId){
   latest.set(record.workId,record)
  }
  newest=Math.max(newest,t)
 }
 const values=[...latest.values()]
 const count=(outcomes:readonly string[])=>values.filter(v=>outcomes.includes(v.outcome)).length
 const pending=values.filter(v=>v.outcome==='EXIT_REVIEW'&&
  v.exitAction!==undefined&&requiresFollowup.has(v.exitAction))
  .map(v=>v.workId).sort()
 return Object.freeze({
  version:'SHARK-SNIPER.CONTINUITY.14' as const,
  recordedDecisions:values.length,
  recordedEntryExpired:count(['ENTRY_EXPIRED']),
  recordedPaperCycles:count(['PAPER_RECORDED']),
  recordedNoTrades:count(['NO_TRADE']),
  recordedMissingProofs:count(['CHAIN_PROOF_REQUIRED','MISSING_PUBLIC_PAIR']),
  recordedExitReviews:count(['EXIT_REVIEW']),
  exitReviewsNeedingFollowup:pending.length,
  exitWorkIdsNeedingFollowup:Object.freeze(pending),
  ...(newest===-Infinity?{}:{
   latestPaperReceiptAt:new Date(newest).toISOString(),
   newestReceiptAgeMs:cutoff-newest,
  }),
  authority:'JOURNALED_PAPER_ONLY' as const,
  sourceLaunchCoverage:'UNKNOWN' as const,
  liveExecution:'NOT_AUTHORIZED' as const,
  alwaysOnCertified:false as const,
  canCreditPurse:false as const,canTrade:false as const,
 })
}

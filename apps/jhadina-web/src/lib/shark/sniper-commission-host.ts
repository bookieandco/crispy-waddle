import {open,unlink,lstat,realpath} from 'node:fs/promises'
import {join,isAbsolute,resolve} from 'node:path'
import {createFileSniperPaperMonitorStore,recoverSniperPaperMonitorJournal} from './sniper-live-paper-journal'
import {runSniperLivePaperTick,runSniperReadOnlyLoop,type SniperPaperMonitorInput} from './sniper-live-paper-monitor'
import type {SniperPublicRead} from './sniper-live-paper-feed'
import {summarizeSniperPaperCoverage} from './sniper-paper-coverage'

/**
 * SHARK-SNIPER.COMMISSION.18/.20 -- opt-in owner-host wrapper.
 * Does not start on import, never accesses wallets, Coffer, Telegram or
 * trading APIs. Does not construct mock market fills or invent source work.
 * Multi-host orchestration needs a separate distributed lease review.
 */
type Dependencies=Readonly<{
 loadCanonicalPaperWork:()=>Promise<SniperPaperMonitorInput>
 readPublicPair:(mint:string,pair:string)=>Promise<SniperPublicRead>
 sleep:(ms:number,signal:AbortSignal)=>Promise<void>
 now:()=>string
}>
type Start=Readonly<{
 directory:string;approvedReadOnly:boolean;signal:AbortSignal
 maxCycles:number;minIntervalMs:number
}>
const LOCK='sniper-paper-owner.lock'
async function checkDirectory(dir:string){
 if(!isAbsolute(dir)||resolve(dir)!==dir)throw Error('SNIPER_HOST_DIRECTORY_INVALID')
 const s=await lstat(dir)
 if(!s.isDirectory()||s.isSymbolicLink()||(s.mode&0o077)!==0||
   typeof process.getuid==='function'&&s.uid!==process.getuid()||
   await realpath(dir)!==dir){
  throw Error('SNIPER_HOST_DIRECTORY_UNSAFE')
 }
}
export async function runPrivateSniperPaperHost(input:Start,deps:Dependencies){
 if(!input.approvedReadOnly)throw Error('SNIPER_HOST_NOT_APPROVED')
 if(input.signal.aborted)throw Error('SNIPER_HOST_ABORTED')
 if(input.maxCycles<1||input.maxCycles>10000||
    !Number.isSafeInteger(input.maxCycles)||input.minIntervalMs<1000||
    input.minIntervalMs>60000||!Number.isSafeInteger(input.minIntervalMs)){
  throw Error('SNIPER_HOST_POLICY_INVALID')
 }
 await checkDirectory(input.directory)
 const lockfile=join(input.directory,LOCK)
 // Exclusive-create lease is conservative on crash: an orphaned file blocks
 // restart until an operator inspects the journal and lock. No auto-steal.
 const lease=await open(lockfile,'wx',0o600)
 try{
  await lease.writeFile(JSON.stringify({
   kind:'SNIPER_RESEARCH_SINGLE_WRITER',pid:process.pid,
   acquiredAt:deps.now(),canTrade:false,
  }))
  await lease.sync()
 }finally{await lease.close()}
 try{
  const before=await recoverSniperPaperMonitorJournal(input.directory)
  const store=createFileSniperPaperMonitorStore(input.directory)
  let lastTickRecords=0
  const result=await runSniperReadOnlyLoop({
   maxCycles:input.maxCycles,minIntervalMs:input.minIntervalMs,
   signal:input.signal,sleep:deps.sleep,
   tick:async()=>{
    const requested=await deps.loadCanonicalPaperWork()
    // Source work is independent, not discovered from the outcome journal.
    // A clock cutoff cannot drift after work was assembled.
    const snapshot=Date.parse(requested.now),clock=Date.parse(deps.now())
    if(!Number.isFinite(snapshot)||!Number.isFinite(clock)||
       snapshot>clock||clock-snapshot>5000){
      throw Error('SNIPER_HOST_SNAPSHOT_CLOCK_MISMATCH')
    }
    const outcome=await runSniperLivePaperTick(requested,{
     readPublicPair:deps.readPublicPair,store,now:deps.now,
    })
    lastTickRecords=outcome.records.length
   },
  })
  const after=await recoverSniperPaperMonitorJournal(input.directory)
  const coverage=summarizeSniperPaperCoverage(after.records,deps.now())
  return Object.freeze({
   version:'SHARK-SNIPER.COMMISSION.18' as const,
   completedCycles:result.completedCycles,
   beforeRecords:before.records.length,afterRecords:after.records.length,
   lastTickRecords,coverage,
   completedNormally:!result.aborted,
   alwaysOnCertified:false as const,
   authority:'PRIVATE_PAPER_RESEARCH_ONLY' as const,
   canTrade:false as const,canSign:false as const,canCreditPurse:false as const,
  })
 }finally{
  // Normal completion / handled exception allows a clean retry; SIGKILL or
  // host crash leaves the lease for explicit, audited operator recovery.
  await unlink(lockfile)
 }
}

import {describe,it,expect,vi} from 'vitest'
import {mkdtemp,readdir,rm,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {runPrivateSniperPaperHost} from './sniper-commission-host'
import {recoverSniperPaperMonitorJournal} from './sniper-live-paper-journal'
const now='2026-10-23T14:00:00Z'
const mint='2'.repeat(32)
const work=()=>({
 now,
 work:[{workId:'exit:1',kind:'RECONCILE_EXIT' as const,queuedAt:'2026-10-23T13:59:59Z'}],
 exits:[{workId:'exit:1',position:{
  positionId:'p:1',tokenAddress:mint,
  entryConfirmedAt:'2026-10-23T13:58:00Z',
  openTokenAmountAtomic:0n,peakReturnBps:100,markedReturnBps:50,
  availableAt:now,evidenceIds:['entry:1'],
 },policy:{maxHoldSeconds:30,profitTakeBps:300,trailingGivebackBps:200,
  maxDrawdownBps:500,maxQuoteAgeMs:1000},unresolvedPreviousExit:true}],
 entries:[],maxPerTick:2,maxEntryQueueMs:2000,
})
const fake=()=>({
 now:()=>now,
 loadCanonicalPaperWork:vi.fn(async()=>work()),
 readPublicPair:vi.fn(async()=>{throw Error('provider must not be called for exit reconciliation')}),
 sleep:vi.fn(async()=>{}),
})
describe('COMMISSION.18/.20 opt-in persistent paper host',()=>{
 it('recovers journal on a new process invocation and never duplicates unsettled exits',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'sniper-commission-'))
  try{
   const d=fake()
   const first=await runPrivateSniperPaperHost({
    directory:dir,approvedReadOnly:true,signal:new AbortController().signal,
    maxCycles:1,minIntervalMs:1000,
   },d)
   expect(first.completedCycles).toBe(1)
   expect(first.afterRecords).toBe(1)
   expect(first.coverage.exitWorkIdsNeedingFollowup).toEqual(['exit:1'])
   expect(first.canSign).toBe(false)
   expect(first.alwaysOnCertified).toBe(false)
   const next=await runPrivateSniperPaperHost({
    directory:dir,approvedReadOnly:true,signal:new AbortController().signal,
    maxCycles:1,minIntervalMs:1000,
   },fake())
   expect(next.beforeRecords).toBe(1)
   expect(next.afterRecords).toBe(1)
   expect((await readdir(dir)).filter(x=>x.endsWith('.lock'))).toHaveLength(0)
   expect((await recoverSniperPaperMonitorJournal(dir)).records).toHaveLength(1)
  }finally{await rm(dir,{recursive:true,force:true})}
 })
 it('fails closed without owner approval or when a crashed worker left an orphan lease',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'sniper-commission-'))
  try{
   await expect(runPrivateSniperPaperHost({
    directory:dir,approvedReadOnly:false,signal:new AbortController().signal,
    maxCycles:1,minIntervalMs:1000,
   },fake())).rejects.toThrow('NOT_APPROVED')
   await writeFile(join(dir,'sniper-paper-owner.lock'),'orphan', {mode:0o600})
   await expect(runPrivateSniperPaperHost({
    directory:dir,approvedReadOnly:true,signal:new AbortController().signal,
    maxCycles:1,minIntervalMs:1000,
   },fake())).rejects.toMatchObject({code:'EEXIST'})
   expect((await recoverSniperPaperMonitorJournal(dir)).records).toHaveLength(0)
  }finally{await rm(dir,{recursive:true,force:true})}
 })
 it('stops when storage or source fails, frees handled-error lease, then safely resumes',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'sniper-commission-'))
  try{
   const fail={...fake(),loadCanonicalPaperWork:async()=>{throw Error('real feed offline')}}
   await expect(runPrivateSniperPaperHost({
    directory:dir,approvedReadOnly:true,signal:new AbortController().signal,
    maxCycles:2,minIntervalMs:1000,
   },fail)).rejects.toThrow('real feed offline')
   expect((await readdir(dir)).filter(x=>x.endsWith('.lock'))).toHaveLength(0)
   const recovered=await runPrivateSniperPaperHost({
    directory:dir,approvedReadOnly:true,signal:new AbortController().signal,
    maxCycles:1,minIntervalMs:1000,
   },fake())
   expect(recovered.afterRecords).toBe(1)
  }finally{await rm(dir,{recursive:true,force:true})}
 })
 it('requires timestamp freshness before a queued paper decision',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'sniper-commission-'))
  try{
   const stale={...fake(),now:()=> '2026-10-23T15:00:00Z'}
   await expect(runPrivateSniperPaperHost({
    directory:dir,approvedReadOnly:true,signal:new AbortController().signal,
    maxCycles:1,minIntervalMs:1000,
   },stale)).rejects.toThrow('CLOCK_MISMATCH')
  }finally{await rm(dir,{recursive:true,force:true})}
 })
})

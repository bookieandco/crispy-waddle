import {describe,it,expect} from 'vitest'
import {mkdtemp,rm,writeFile,chmod,readdir,unlink,symlink} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createFileSniperPaperMonitorStore,recoverSniperPaperMonitorJournal} from './sniper-live-paper-journal'
import type {SniperPaperMonitorRecord} from './sniper-live-paper-monitor'
const rec=(workId:string):SniperPaperMonitorRecord=>({
 recordId:'sniper-paper:'+workId+':2026-10-22T20:00:01Z',workId,
 observedAt:'2026-10-22T20:00:01Z',outcome:'EXIT_REVIEW',
 reasonCodes:['NO_VERIFIED_FRESH_FULL_POSITION_EXIT'],
 exitAction:'EXIT_ROUTE_MISSING',authority:'PAPER_RESEARCH_ONLY',
 canExecute:false,canSign:false,canCreditPurse:false,
})
describe('LIVE-PAPER.09 owner-only fsynced local journal',()=>{
 it('commits and replays across new store instances without duplicating paper receipts',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'jh-sniper-paper-'))
  try{
   const one=createFileSniperPaperMonitorStore(dir)
   expect(await one.append(rec('exit1'))).toBe('INSERTED')
   const next=createFileSniperPaperMonitorStore(dir)
   expect(await next.append(rec('exit1'))).toBe('REPLAY_IDENTICAL')
   const recovered=await recoverSniperPaperMonitorJournal(dir)
   expect(recovered.records).toHaveLength(1)
   expect(recovered.records[0]?.exitAction).toBe('EXIT_ROUTE_MISSING')
   expect(recovered.canExecute).toBe(false)
   expect(recovered.headDigest).toMatch(/^[a-f0-9]{64}$/)
  }finally{await rm(dir,{recursive:true,force:true})}
 })
 it('fails closed on same receipt ID with conflicting exit evidence',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'jh-sniper-paper-'))
  try{
   const store=createFileSniperPaperMonitorStore(dir)
   await store.append(rec('exit1'))
   await expect(store.append({...rec('exit1'),reasonCodes:['STOLEN']})).rejects.toThrow('REPLAY_CONFLICT')
   expect((await recoverSniperPaperMonitorJournal(dir)).records).toHaveLength(1)
  }finally{await rm(dir,{recursive:true,force:true})}
 })
 it('corruption is an error, not a valid recovered paper profit or trade',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'jh-sniper-paper-'))
  try{
   const store=createFileSniperPaperMonitorStore(dir)
   await store.append(rec('exit2'))
   const files=await import('node:fs/promises').then(x=>x.readdir(dir))
   await writeFile(join(dir,files[0]!),'{}')
   await expect(recoverSniperPaperMonitorJournal(dir)).rejects.toThrow('CORRUPT')
  }finally{await rm(dir,{recursive:true,force:true})}
 })
 it('preserves an expired coin in the recovered missed-launch denominator',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'jh-sniper-paper-'))
  try{
   const receipt:SniperPaperMonitorRecord={...rec('late'),outcome:'ENTRY_EXPIRED',
    reasonCodes:['ENTRY_EXPIRED_IN_QUEUE','NO_ORDER_OR_PAPER_FILL'],exitAction:undefined}
   const store=createFileSniperPaperMonitorStore(dir)
   expect(await store.append(receipt)).toBe('INSERTED')
   expect(await createFileSniperPaperMonitorStore(dir).append(receipt)).toBe('REPLAY_IDENTICAL')
   const recovered=await recoverSniperPaperMonitorJournal(dir)
   expect(recovered.records[0]?.outcome).toBe('ENTRY_EXPIRED')
   expect(recovered.records[0]?.canCreditPurse).toBe(false)
  }finally{await rm(dir,{recursive:true,force:true})}
 })
 it('refuses a symlink occupying a receipt filename during duplicate retry',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'jh-sniper-paper-'))
  try{
   const store=createFileSniperPaperMonitorStore(dir)
   await store.append(rec('exit1'))
   await store.append(rec('exit2'))
   const files=(await readdir(dir)).sort()
   // Identify receipt belonging to exit1 by temporarily replaying its
   // content, then replace it with a symlink to an existing exit2 receipt.
   const {readFile}=await import('node:fs/promises')
   const first=JSON.parse(await readFile(join(dir,files[0]!),'utf8')) as {record:{workId:string}}
   const original=first.record.workId==='exit1'?files[0]!:files[1]!
   const other=original===files[0]?files[1]!:files[0]!
   await unlink(join(dir,original))
   await symlink(join(dir,other),join(dir,original))
   await expect(store.append(rec('exit1'))).rejects.toThrow('JOURNAL_FILE_UNSAFE')
   await expect(recoverSniperPaperMonitorJournal(dir)).rejects.toThrow('JOURNAL_FILE_UNSAFE')
  }finally{await rm(dir,{recursive:true,force:true})}
 })
 it('requires deterministic work-and-time identity in every receipt',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'jh-sniper-paper-'))
  try{
   await expect(createFileSniperPaperMonitorStore(dir).append({
    ...rec('exit'),recordId:'sniper-paper:unrelated:2026-10-22T20:00:01Z',
   })).rejects.toThrow('JOURNAL_RECORD_INVALID')
  }finally{await rm(dir,{recursive:true,force:true})}
 })
 it('rejects insecure world-readable journal directories',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'jh-sniper-paper-'))
  try{
   await chmod(dir,0o755)
   await expect(createFileSniperPaperMonitorStore(dir).append(rec('exit3'))).rejects.toThrow('DIR_UNSAFE')
  }finally{await rm(dir,{recursive:true,force:true})}
 })
})

import {createHash} from 'node:crypto'
import {lstat,realpath,readdir,open,readFile} from 'node:fs/promises'
import {isAbsolute,join,resolve} from 'node:path'
import type {SniperPaperMonitorRecord,SniperPaperMonitorStore} from './sniper-live-paper-monitor'

/** LIVE-PAPER.09 — local, append-only crash replay, NOT a money ledger,
 * signer, SHARK model-memory store, or multi-host distributed lock.
 * A separately authorized worker MUST mount a persistent, owner-only volume.
 */
const digest=(x:string)=>createHash('sha256').update(x).digest('hex')
const utf8=(r:SniperPaperMonitorRecord)=>JSON.stringify(r)
const maxBytes=8_192
async function privateDir(directory:string){
 if(!isAbsolute(directory)||resolve(directory)!==directory)throw Error('SNIPER_PAPER_DIR_INVALID')
 const s=await lstat(directory)
 if(s.isSymbolicLink()||!s.isDirectory()||(s.mode&0o077)!==0)throw Error('SNIPER_PAPER_DIR_UNSAFE')
 if(typeof process.getuid==='function'&&s.uid!==process.getuid())throw Error('SNIPER_PAPER_DIR_OWNER_INVALID')
 if(await realpath(directory)!==directory)throw Error('SNIPER_PAPER_DIR_ALIAS_INVALID')
}
function verify(r:SniperPaperMonitorRecord){
 if(r.recordId!=='sniper-paper:'+r.workId+':'+r.observedAt||!r.workId.trim()||
    !Number.isFinite(Date.parse(r.observedAt))||
    r.authority!=='PAPER_RESEARCH_ONLY'||r.canExecute!==false||
    r.canSign!==false||r.canCreditPurse!==false||
    !Array.isArray(r.reasonCodes)||r.reasonCodes.length>64||
    !['EXIT_REVIEW','PUBLIC_PRICE_ONLY','MISSING_PUBLIC_PAIR','CHAIN_PROOF_REQUIRED',
      'PAPER_RECORDED','NO_TRADE','ENTRY_EXPIRED'].includes(r.outcome)){
  throw Error('SNIPER_PAPER_JOURNAL_RECORD_INVALID')
 }
}
const nameOf=(r:SniperPaperMonitorRecord)=>digest(r.recordId)+'.json'
function fromEnvelope(raw:string):SniperPaperMonitorRecord{
 if(raw.length>maxBytes)throw Error('SNIPER_PAPER_JOURNAL_TOO_LARGE')
 const parsed:unknown=JSON.parse(raw)
 if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error('SNIPER_PAPER_JOURNAL_CORRUPT')
 const x=parsed as {digest?:unknown;record?:unknown}
 if(typeof x.digest!=='string'||!x.record||typeof x.record!=='object')throw Error('SNIPER_PAPER_JOURNAL_CORRUPT')
 const r=x.record as SniperPaperMonitorRecord
 verify(r)
 if(x.digest!==digest(utf8(r)))throw Error('SNIPER_PAPER_JOURNAL_CORRUPT_DIGEST')
 return r
}
export function createFileSniperPaperMonitorStore(directory:string):SniperPaperMonitorStore{
 return Object.freeze({
  async append(record:SniperPaperMonitorRecord){
   verify(record)
   const payload=JSON.stringify({digest:digest(utf8(record)),record})
   if(payload.length>maxBytes)throw Error('SNIPER_PAPER_JOURNAL_TOO_LARGE')
   await privateDir(directory)
   const target=join(directory,nameOf(record))
   let file:Awaited<ReturnType<typeof open>>|undefined
   try{
    file=await open(target,'wx',0o600)
    await file.writeFile(payload,'utf8')
    await file.sync()
    await file.close()
    file=undefined
    // Sync directory metadata so a completed append survives abrupt restart.
    const handle=await open(directory,'r')
    try{await handle.sync()}finally{await handle.close()}
    return 'INSERTED' as const
   }catch(err){
    if(file){try{await file.close()}catch{}}
    if((err as NodeJS.ErrnoException).code!=='EEXIST')throw err
    // Never follow an existing symlink or reuse an insecure/corrupt receipt.
    // Owner-only directory permissions are necessary but not sufficient.
    const stat=await lstat(target)
    if(!stat.isFile()||stat.isSymbolicLink()||(stat.mode&0o077)!==0||stat.size>maxBytes){
     throw Error('SNIPER_PAPER_JOURNAL_FILE_UNSAFE')
    }
    const original=fromEnvelope(await readFile(target,'utf8'))
    if(original.recordId!==record.recordId||utf8(original)!==utf8(record)){
     throw Error('SNIPER_PAPER_JOURNAL_REPLAY_CONFLICT')
    }
    return 'REPLAY_IDENTICAL' as const
   }
  },
 })
}
/** Sorted verified evidence for an explicit owner-host resume; no replay can
 * manufacture a missing exit quote, filled trade or onchain settlement. */
export async function recoverSniperPaperMonitorJournal(directory:string):Promise<Readonly<{
 records:readonly SniperPaperMonitorRecord[];headDigest:string;
 authority:'PAPER_REPLAY_ONLY';canExecute:false
}>>{
 await privateDir(directory)
 const files=(await readdir(directory)).filter(x=>x.endsWith('.json')).sort()
 if(files.length>100000)throw Error('SNIPER_PAPER_JOURNAL_CAPACITY')
 const records:SniperPaperMonitorRecord[]=[]
 for(const file of files){
  if(!/^[a-f0-9]{64}\.json$/.test(file))throw Error('SNIPER_PAPER_JOURNAL_FILENAME_INVALID')
  const target=join(directory,file),s=await lstat(target)
  if(!s.isFile()||s.isSymbolicLink()||(s.mode&0o077)!==0||s.size>maxBytes){
   throw Error('SNIPER_PAPER_JOURNAL_FILE_UNSAFE')
  }
  const record=fromEnvelope(await readFile(target,'utf8'))
  if(nameOf(record)!==file)throw Error('SNIPER_PAPER_JOURNAL_ID_MISMATCH')
  records.push(record)
 }
 records.sort((a,b)=>Date.parse(a.observedAt)-Date.parse(b.observedAt)||a.recordId.localeCompare(b.recordId))
 return Object.freeze({
  records:Object.freeze(records),
  headDigest:digest(records.map(x=>digest(utf8(x))).join(':')),
  authority:'PAPER_REPLAY_ONLY',canExecute:false,
 })
}

/**
 * JHADINA-KALSHI.05 — fail-closed single-process host admission.
 * A stale lock is a repair/inspection task, never an invitation to run two
 * writers against an evidence journal. Use a durable, single-host filesystem.
 */
import {randomUUID} from 'node:crypto';
import {open,mkdir,readFile,unlink} from 'node:fs/promises';
import {dirname} from 'node:path';

export type KalshiJournalLease=Readonly<{
  path:string;
  leaseId:string;
  release:()=>Promise<void>;
}>;

export async function acquireKalshiJournalLease(journalPath:string):Promise<KalshiJournalLease>{
  if(!journalPath.trim() || !journalPath.startsWith('/'))
    throw new Error('KALSHI_LEASE_ABSOLUTE_JOURNAL_REQUIRED');
  const path=journalPath+'.lock';
  await mkdir(dirname(path),{recursive:true});
  const leaseId=randomUUID();
  const content=JSON.stringify({
    schema:'KALSHI_SINGLE_WRITER_LEASE_V1',leaseId,pid:process.pid,
    createdAt:new Date().toISOString(),journalPath,
  })+'\n';
  let file:Awaited<ReturnType<typeof open>>;
  try{file=await open(path,'wx',0o600);}
  catch(error){
    if((error as NodeJS.ErrnoException).code==='EEXIST')
      throw new Error('KALSHI_LEASE_OCCUPIED_MANUAL_REVIEW_REQUIRED');
    throw error;
  }
  try{
    await file.writeFile(content,'utf8');
    await file.sync();
  }catch(error){
    // On a partial failure leave the lock in place for manual review.
    await file.close();
    throw error;
  }
  await file.close();
  let released=false;
  return Object.freeze({
    path,leaseId,
    release:async()=>{
      if(released)return;
      // Never remove someone else's or a replaced lock.
      const current=await readFile(path,'utf8');
      if(current!==content)throw new Error('KALSHI_LEASE_OWNERSHIP_LOST');
      await unlink(path);
      released=true;
    },
  });
}
